/**
 * Core types and interfaces for OpenAnalytics
 */

export interface Event {
  id?: string;
  type: string;
  timestamp: number;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  ip?: string;
  ua?: string;
  referrer?: string;
  url?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  [key: string]: any;
}

export interface QueryOptions {
  start?: number;
  end?: number;
  filter?: string;
  limit?: number;
}

export interface QueryResult {
  events?: Event[];
  metrics?: Record<string, number>;
  timeseries?: Array<{ timestamp: number, value: number }>;
}

export interface Storage {
  storeEvents(events: Event[]): Promise<void>;
  queryEvents(options: QueryOptions): Promise<QueryResult>;
}

// Built-in memory storage for development
export interface MemoryStorageOptions {
  maxEvents?: number;
}

export function MemoryStorage(options: MemoryStorageOptions = {}): Storage {
  const { maxEvents = 10000 } = options;
  const events: Event[] = [];

  return {
    async storeEvents(newEvents: Event[]): Promise<void> {
      events.push(...newEvents);
      
      // Keep only the most recent events if we exceed the limit
      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }
    },

    async queryEvents(options: QueryOptions): Promise<QueryResult> {
      const { start, end = Date.now(), filter, limit = 1000 } = options;
      const startTime = start || 0;

      // Filter events by timestamp
      let filteredEvents = events.filter(event => {
        return event.timestamp >= startTime && event.timestamp <= end;
      });

      // Apply additional filtering if provided
      if (filter) {
        try {
          const filterFn = new Function('event', `return ${filter}`);
          filteredEvents = filteredEvents.filter(filterFn);
        } catch (e) {
          console.error("Invalid filter expression:", e);
        }
      }

      // Sort by timestamp (most recent first)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      const resultEvents = filteredEvents.slice(0, limit);

      // Calculate basic metrics
      const uniqueUsers = new Set(resultEvents.map(e => e.userId || e.ip)).size;
      const pageViews = resultEvents.filter(e => e.type === 'pageview').length;

      return {
        events: resultEvents,
        metrics: {
          totalEvents: resultEvents.length,
          uniqueUsers,
          pageViews,
        },
      };
    }
  };
}