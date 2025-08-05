/**
 * Event processing utilities for OpenAnalytics
 * 
 * This module provides functions for processing, validating, and transforming
 * analytics events before they are stored.
 */

import type { Event } from "./storage";

export interface ProcessorOptions {
  enableGeoIP?: boolean;
  enableUserAgentParsing?: boolean;
  enableBotDetection?: boolean;
  customFields?: Record<string, (event: Event) => any>;
}

export type EventProcessor = (events: Event[]) => Promise<Event[]>;

/**
 * Creates a comprehensive event processor with optional enhancements
 */
export function createEventProcessor(options: ProcessorOptions = {}): EventProcessor {
  const {
    enableGeoIP = false,
    enableUserAgentParsing = false,
    enableBotDetection = false,
    customFields = {},
  } = options;

  return async (events: Event[]): Promise<Event[]> => {
    const processedEvents: Event[] = [];

    for (const event of events) {
      let processedEvent = { ...event };

      // Validate required fields
      if (!isValidEvent(processedEvent)) {
        continue; // Skip invalid events
      }

      // Normalize event data
      processedEvent = normalizeEvent(processedEvent);

      // Bot detection
      if (enableBotDetection && isBotTraffic(processedEvent)) {
        // Either skip bot traffic or mark it
        processedEvent.properties = {
          ...processedEvent.properties,
          isBot: true,
        };
      }

      // User agent parsing
      if (enableUserAgentParsing && processedEvent.ua) {
        const parsedUA = parseUserAgent(processedEvent.ua);
        processedEvent.properties = {
          ...processedEvent.properties,
          browser: parsedUA.browser,
          os: parsedUA.os,
          device: parsedUA.device,
        };
      }

      // GeoIP lookup (placeholder - would require actual GeoIP service)
      if (enableGeoIP && processedEvent.ip) {
        const geoData = await lookupGeoIP(processedEvent.ip);
        if (geoData) {
          processedEvent.properties = {
            ...processedEvent.properties,
            country: geoData.country,
            region: geoData.region,
            city: geoData.city,
          };
        }
      }

      // Apply custom field processors
      for (const [fieldName, processor] of Object.entries(customFields)) {
        try {
          processedEvent.properties = {
            ...processedEvent.properties,
            [fieldName]: processor(processedEvent),
          };
        } catch (error) {
          console.warn(`Custom field processor "${fieldName}" failed:`, error);
        }
      }

      processedEvents.push(processedEvent);
    }

    return processedEvents;
  };
}

/**
 * Validates that an event has the minimum required fields
 */
function isValidEvent(event: Event): boolean {
  return !!(
    event.type &&
    typeof event.timestamp === 'number' &&
    event.timestamp > 0 &&
    event.timestamp <= Date.now() + 60000 // Allow 1 minute future tolerance
  );
}

/**
 * Normalizes event data for consistency
 */
function normalizeEvent(event: Event): Event {
  return {
    ...event,
    id: event.id || crypto.randomUUID(),
    timestamp: Math.floor(event.timestamp),
    type: event.type.toLowerCase().trim(),
    properties: event.properties || {},
    siteId: event.siteId?.trim(),
    userId: event.userId?.trim(),
    sessionId: event.sessionId?.trim(),
    url: event.url?.trim(),
    referrer: event.referrer?.trim(),
  };
}

/**
 * Simple bot detection based on user agent patterns
 */
function isBotTraffic(event: Event): boolean {
  if (!event.ua) return false;

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /facebook/i,
    /twitter/i,
    /linkedin/i,
    /whatsapp/i,
    /telegram/i,
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /pinterestbot/i,
    /redditbot/i,
    /applebot/i,
    /discordbot/i,
    /telegrambot/i,
    /slackbot/i,
    /whatsapp/i,
    /headlesschrome/i,
    /phantomjs/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
  ];

  return botPatterns.some(pattern => pattern.test(event.ua!));
}

/**
 * Basic user agent parsing
 */
function parseUserAgent(userAgent: string): {
  browser?: string;
  os?: string;
  device?: string;
} {
  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome') && !ua.includes('edge')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('msie')) browser = 'Internet Explorer';

  // OS detection
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Device detection
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';

  return { browser, os, device };
}

/**
 * Placeholder for GeoIP lookup - would integrate with actual service
 */
async function lookupGeoIP(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
} | null> {
  // In a real implementation, this would call a GeoIP service like:
  // - MaxMind GeoLite2
  // - IPinfo.io
  // - ipapi.co
  // - CloudFlare's CF-IPCountry header
  
  // For now, return null (no geo data)
  return null;
}

/**
 * Pre-built processors for common use cases
 */
export const processors = {
  /**
   * Basic processor with sensible defaults
   */
  basic: createEventProcessor({
    enableBotDetection: true,
    enableUserAgentParsing: true,
  }),

  /**
   * Privacy-focused processor that minimizes data collection
   */
  privacy: createEventProcessor({
    enableBotDetection: true,
    customFields: {
      // Remove potentially sensitive data
      sanitized: (event) => {
        const sanitized = { ...event };
        delete sanitized.ip;
        delete sanitized.ua;
        if (sanitized.properties) {
          delete sanitized.properties.email;
          delete sanitized.properties.phone;
          delete sanitized.properties.ssn;
        }
        return true;
      },
    },
  }),

  /**
   * Enhanced processor with all features enabled
   */
  enhanced: createEventProcessor({
    enableGeoIP: true,
    enableUserAgentParsing: true,
    enableBotDetection: true,
    customFields: {
      // Add session duration calculation
      sessionDuration: (event) => {
        // This would calculate session duration if we had session start time
        return null;
      },
      
      // Add time-based segmentation
      timeSegment: (event) => {
        const hour = new Date(event.timestamp).getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
      },
    },
  }),
};

export default createEventProcessor;