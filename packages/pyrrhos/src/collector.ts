import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Storage, Event } from "./storage";

export interface CollectorOptions {
  storage: Storage;
  domains?: string[];  // Allowed domains for CORS
  sample?: number;     // Sampling rate (0-1)
  writeKeys?: string[]; // API keys for authentication
  rateLimits?: {
    eventsPerMinute?: number;
    maxBatchSize?: number;
  };
  privacy?: {
    anonymizeIPs?: boolean;
    respectDNT?: boolean;
  };
  processEvents?: (events: Event[]) => Promise<Event[]>;  // Custom processing
}

export function collector(options: CollectorOptions) {
  const app = new Hono();
  
  const {
    storage,
    domains = ["*"],
    sample = 1,
    writeKeys = [],
    rateLimits = { eventsPerMinute: 1000, maxBatchSize: 100 },
    privacy = { anonymizeIPs: true, respectDNT: true },
    processEvents
  } = options;

  // Rate limiting storage (in production, use Redis or similar)
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  // CORS middleware
  app.use("*", cors({
    origin: domains,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }));

  // Authentication middleware for protected endpoints
  const authenticate = async (c: any, next: any) => {
    if (writeKeys.length === 0) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token || !writeKeys.includes(token)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    await next();
  };

  // Rate limiting middleware
  const rateLimit = async (c: any, next: any) => {
    const ip = c.req.header("CF-Connecting-IP") || 
               c.req.header("X-Forwarded-For") || 
               c.req.header("X-Real-IP") || 
               "unknown";
    
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const key = `rate_limit:${ip}`;
    
    const current = rateLimitStore.get(key);
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      current.count++;
      if (current.count > (rateLimits.eventsPerMinute || 1000)) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }
    }
    
    await next();
  };

  // Helper function to anonymize IP addresses
  const anonymizeIP = (ip: string): string => {
    if (!privacy.anonymizeIPs) return ip;
    
    // IPv4: Remove last octet
    if (ip.includes('.')) {
      const parts = ip.split('.');
      return parts.slice(0, 3).join('.') + '.0';
    }
    
    // IPv6: Remove last 64 bits
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    }
    
    return ip;
  };

  // Helper function to check Do Not Track
  const isDNTEnabled = (c: any): boolean => {
    return c.req.header("DNT") === "1" || c.req.header("Sec-GPC") === "1";
  };

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

  // Event collection endpoint
  app.post("/api/v1/events", authenticate, rateLimit, async (c) => {
    try {
      // Check Do Not Track
      if (privacy.respectDNT && isDNTEnabled(c)) {
        return c.json({ status: "ignored", reason: "DNT enabled" });
      }

      const payload = await c.req.json();
      
      // Handle both single events and batches
      const eventData = payload.batch || [payload];
      
      // Validate batch size
      if (eventData.length > (rateLimits.maxBatchSize || 100)) {
        return c.json({ error: "Batch too large" }, 413);
      }

      // Apply sampling
      if (sample < 1 && Math.random() > sample) {
        return c.json({ status: "sampled" });
      }

      // Extract metadata
      const ip = c.req.header("CF-Connecting-IP") || 
                c.req.header("X-Forwarded-For") || 
                c.req.header("X-Real-IP");
      const userAgent = c.req.header("User-Agent");
      const timestamp = Date.now();

      // Enrich events with metadata
      const enrichedEvents: Event[] = eventData.map((event: any) => ({
        id: event.id || crypto.randomUUID(),
        timestamp: event.timestamp || timestamp,
        type: event.type || "custom",
        siteId: event.siteId,
        userId: event.userId,
        sessionId: event.sessionId || event.anonymousId,
        properties: event.properties || {},
        ip: ip ? anonymizeIP(ip) : undefined,
        ua: userAgent,
        referrer: event.context?.referrer || event.referrer,
        url: event.context?.url || event.url,
        language: event.context?.language || event.language,
        screenWidth: event.context?.screenWidth || event.screenWidth,
        screenHeight: event.context?.screenHeight || event.screenHeight,
      }));

      // Validate events
      const validEvents = enrichedEvents.filter(event => {
        // Basic validation
        if (!event.type || typeof event.timestamp !== 'number') {
          return false;
        }
        
        // Check event age (reject events older than 7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (timestamp - event.timestamp > maxAge) {
          return false;
        }
        
        // Check event size (max 32KB)
        const eventSize = JSON.stringify(event).length;
        if (eventSize > 32 * 1024) {
          return false;
        }
        
        return true;
      });

      if (validEvents.length === 0) {
        return c.json({ error: "No valid events to process" }, 400);
      }

      // Apply custom processing if provided
      const processedEvents = processEvents 
        ? await processEvents(validEvents)
        : validEvents;

      // Store events
      await storage.storeEvents(processedEvents);

      return c.json({ 
        status: "ok", 
        processed: processedEvents.length,
        timestamp 
      });

    } catch (error) {
      console.error("Error processing events:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // Legacy endpoint for backward compatibility
  app.post("/collect", authenticate, rateLimit, async (c) => {
    // Redirect to new endpoint
    return app.fetch(new Request(c.req.url.replace("/collect", "/api/v1/events"), {
      method: "POST",
      headers: c.req.header(),
      body: c.req.body
    }));
  });

  // Query endpoint for analytics data
  app.get("/api/v1/query", authenticate, async (c) => {
    try {
      const params = c.req.query();
      
      // Parse query parameters  
      const options = {
        start: params.start ? parseInt(params.start) : undefined,
        end: params.end ? parseInt(params.end) : undefined,
        filter: params.filter,
        limit: params.limit ? Math.min(parseInt(params.limit), 10000) : 1000,
      };

      const results = await storage.queryEvents(options);
      return c.json(results);
      
    } catch (error) {
      console.error("Error querying events:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // Metrics endpoint
  app.get("/api/v1/metrics", authenticate, async (c) => {
    try {
      const params = c.req.query();
      const now = Date.now();
      const timeRange = {
        start: params.start ? parseInt(params.start) : now - (24 * 60 * 60 * 1000), // Last 24h
        end: params.end ? parseInt(params.end) : now,
      };

      const results = await storage.queryEvents(timeRange);
      
      // Calculate additional metrics
      const events = results.events || [];
      const pageViews = events.filter(e => e.type === 'page_view' || e.type === 'pageview').length;
      const uniqueVisitors = new Set(events.map(e => e.sessionId)).size;
      const uniqueUsers = new Set(events.map(e => e.userId || e.sessionId)).size;
      
      // Calculate bounce rate (sessions with only 1 page view)
      const sessionsMap = new Map<string, number>();
      events.forEach(e => {
        if (e.type === 'page_view' || e.type === 'pageview') {
          const sessionId = e.sessionId || 'unknown';
          sessionsMap.set(sessionId, (sessionsMap.get(sessionId) || 0) + 1);
        }
      });
      
      const bounceRate = sessionsMap.size > 0 
        ? Array.from(sessionsMap.values()).filter(count => count === 1).length / sessionsMap.size
        : 0;

      return c.json({
        timeRange,
        metrics: {
          totalEvents: events.length,
          pageViews,
          uniqueVisitors,
          uniqueUsers,
          bounceRate: Math.round(bounceRate * 100) / 100,
          avgSessionLength: 0, // TODO: Calculate from session data
          ...results.metrics
        }
      });

    } catch (error) {
      console.error("Error calculating metrics:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  return app;
}
