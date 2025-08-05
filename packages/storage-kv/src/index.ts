/**
 * @pyrrhos/storage-kv - Cloudflare KV Storage Adapter
 */

import type { Storage, Event, QueryOptions, QueryResult } from "@pyrrhos/core";

export interface KVStorageOptions {
  namespace: KVNamespace;
  ttl?: number; // Time to live in seconds
}

export function KVStorage(options: KVStorageOptions): Storage {
  const { namespace, ttl = 60 * 60 * 24 * 30 } = options; // 30 days default

  return {
    async storeEvents(events: Event[]): Promise<void> {
      // Group events by day for efficient querying
      const eventsByDay = events.reduce((acc, event) => {
        const day = new Date(event.timestamp).toISOString().split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(event);
        return acc;
      }, {} as Record<string, Event[]>);

      // Store events in batches by day
      const promises = Object.entries(eventsByDay).map(async ([day, dayEvents]) => {
        const key = `events:${day}`;

        // Append to existing events
        const existing = await namespace.get(key, "json") as Event[] || [];
        const combined = [...existing, ...dayEvents];

        await namespace.put(key, JSON.stringify(combined), { expirationTtl: ttl });
      });

      await Promise.all(promises);
    },

    async queryEvents(options: QueryOptions): Promise<QueryResult> {
      const { start, end = Date.now(), filter } = options;

      // Calculate date range
      const startDate = start ? new Date(start) : new Date(Date.now() - 86400000); // Default to last 24h
      const endDate = new Date(end);

      // Generate list of days to query
      const days = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        days.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Fetch events for each day
      const allEvents: Event[] = [];
      await Promise.all(days.map(async (day) => {
        const key = `events:${day}`;
        const events = await namespace.get(key, "json") as Event[] || [];

        // Filter events by timestamp
        const filteredEvents = events.filter(event => {
          const timestamp = event.timestamp;
          return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
        });

        allEvents.push(...filteredEvents);
      }));

      // Apply additional filtering if needed
      let filteredEvents = allEvents;
      if (filter) {
        try {
          const filterFn = new Function('event', `return ${filter}`);
          filteredEvents = allEvents.filter(filterFn);
        } catch (e) {
          // Invalid filter expression
          console.error("Invalid filter expression:", e);
        }
      }

      return {
        events: filteredEvents.slice(0, options.limit || 1000),
      };
    }
  };
}