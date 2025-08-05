import { Hono } from "hono";
import type { Storage } from "../storage";
import { Dashboard } from "./dashboard";
import { lightTheme, darkTheme } from "./theme";

export interface DashboardServerOptions {
  storage: Storage;
  apiKey?: string;
  title?: string;
  theme?: 'light' | 'dark';
}

export function createDashboard(options: DashboardServerOptions) {
  const app = new Hono();
  const { storage, apiKey, title = "OpenAnalytics Dashboard", theme = 'light' } = options;

  // Authentication middleware
  const authenticate = async (c: any, next: any) => {
    if (!apiKey) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const queryToken = c.req.query("key");
    
    if (!token && !queryToken) {
      return c.html(`
        <html>
          <head>
            <title>Authentication Required</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .auth-form {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 400px;
                width: 100%;
              }
              input {
                width: 100%;
                padding: 0.75rem;
                margin: 0.5rem 0;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
              }
              button {
                width: 100%;
                padding: 0.75rem;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 1rem;
                cursor: pointer;
              }
              button:hover {
                background: #2563eb;
              }
            </style>
          </head>
          <body>
            <div class="auth-form">
              <h2>Analytics Dashboard</h2>
              <p>Please enter your API key to access the dashboard.</p>
              <form method="get">
                <input type="password" name="key" placeholder="API Key" required />
                <button type="submit">Access Dashboard</button>
              </form>
            </div>
          </body>
        </html>
      `, 401);
    }
    
    if (token !== apiKey && queryToken !== apiKey) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    
    await next();
  };

  // Main dashboard route
  app.get("/", authenticate, async (c) => {
    try {
      // Parse time range from query parameters
      const params = c.req.query();
      let timeRange: { start: number; end: number } | undefined;
      
      if (params.start && params.end) {
        timeRange = {
          start: parseInt(params.start),
          end: parseInt(params.end),
        };
      } else if (params.range) {
        const now = Date.now();
        const ranges: Record<string, number> = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        };
        
        const rangeMs = ranges[params.range] || ranges['24h'];
        timeRange = {
          start: now - rangeMs,
          end: now,
        };
      }

      const selectedTheme = params.theme === 'dark' ? darkTheme : lightTheme;
      const dashboardHtml = await Dashboard({
        storage,
        apiKey,
        theme: selectedTheme,
        title,
        timeRange,
      });

      return c.html(dashboardHtml);
    } catch (error) {
      console.error("Dashboard error:", error);
      return c.html(`
        <html>
          <head>
            <title>Error</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .error {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>⚠️ Dashboard Error</h2>
              <p>There was an error loading the dashboard. Please try again later.</p>
              <details>
                <summary>Error Details</summary>
                <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
              </details>
            </div>
          </body>
        </html>
      `, 500);
    }
  });

  // API endpoint for live metrics (for auto-refresh)
  app.get("/api/metrics", authenticate, async (c) => {
    try {
      const params = c.req.query();
      const now = Date.now();
      const timeRange = {
        start: params.start ? parseInt(params.start) : now - (24 * 60 * 60 * 1000),
        end: params.end ? parseInt(params.end) : now,
      };

      const results = await storage.queryEvents({
        start: timeRange.start,
        end: timeRange.end,
        limit: 10000,
      });

      const events = results.events || [];
      const pageViews = events.filter(e => e.type === 'page_view' || e.type === 'pageview').length;
      const uniqueVisitors = new Set(events.map(e => e.sessionId)).size;

      // Calculate real-time metrics
      const last5Minutes = now - (5 * 60 * 1000);
      const recentEvents = events.filter(e => e.timestamp >= last5Minutes);
      const recentPageViews = recentEvents.filter(e => e.type === 'page_view' || e.type === 'pageview').length;
      const activeVisitors = new Set(recentEvents.map(e => e.sessionId)).size;

      return c.json({
        timeRange,
        metrics: {
          totalEvents: events.length,
          pageViews,
          uniqueVisitors,
          recentPageViews,
          activeVisitors,
        },
        timestamp: now,
      });
    } catch (error) {
      console.error("Metrics API error:", error);
      return c.json({ error: "Failed to fetch metrics" }, 500);
    }
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

  return app;
}