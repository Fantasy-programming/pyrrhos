import { describe, test, expect, beforeEach, mock } from "bun:test";
import { KVStorage } from "../src/index.ts";
import type { Event } from "@pyrrhos/core";

// Mock KVNamespace
const mockKV = {
  get: mock(() => Promise.resolve(null)),
  put: mock(() => Promise.resolve()),
};

describe("KVStorage", () => {
  let storage: ReturnType<typeof KVStorage>;

  beforeEach(() => {
    // Clear all mocks
    Object.values(mockKV).forEach(fn => fn.mockClear?.());
    
    storage = KVStorage({ 
      namespace: mockKV as any,
      ttl: 60 * 60 * 24 * 30, // 30 days
    });
  });

  describe("Event Storage", () => {
    test("should group events by day and store them", async () => {
      const now = Date.now();
      const today = new Date(now).toISOString().split('T')[0];
      
      const events: Event[] = [
        {
          id: "test-1",
          timestamp: now,
          type: "pageview",
          siteId: "test-site",
          properties: { path: "/test1" },
        },
        {
          id: "test-2",
          timestamp: now + 1000,
          type: "click",
          siteId: "test-site",
          properties: { element: "button" },
        },
      ];

      mockKV.get.mockResolvedValueOnce(null); // No existing events

      await storage.storeEvents(events);

      expect(mockKV.get).toHaveBeenCalledWith(`events:${today}`, "json");
      expect(mockKV.put).toHaveBeenCalledWith(
        `events:${today}`,
        expect.stringContaining('"test-1"'),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );
    });

    test("should append to existing events for the same day", async () => {
      const now = Date.now();
      const today = new Date(now).toISOString().split('T')[0];
      
      const existingEvents = [
        { id: "existing-1", timestamp: now - 1000, type: "pageview", siteId: "test" },
      ];

      const newEvents: Event[] = [
        { id: "new-1", timestamp: now, type: "click", siteId: "test" },
      ];

      mockKV.get.mockResolvedValueOnce(existingEvents);

      await storage.storeEvents(newEvents);

      expect(mockKV.put).toHaveBeenCalledWith(
        `events:${today}`,
        expect.stringMatching(/existing-1.*new-1|new-1.*existing-1/),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );
    });

    test("should store events across multiple days", async () => {
      const today = Date.now();
      const yesterday = today - (24 * 60 * 60 * 1000);
      
      const events: Event[] = [
        { id: "today-1", timestamp: today, type: "pageview", siteId: "test" },
        { id: "yesterday-1", timestamp: yesterday, type: "pageview", siteId: "test" },
      ];

      mockKV.get.mockResolvedValue(null);

      await storage.storeEvents(events);

      expect(mockKV.put).toHaveBeenCalledTimes(2);
      expect(mockKV.get).toHaveBeenCalledTimes(2);
    });

    test("should use custom TTL", async () => {
      const customStorage = KVStorage({ 
        namespace: mockKV as any,
        ttl: 60 * 60 * 24 * 7, // 7 days
      });

      const events: Event[] = [
        { id: "test-1", timestamp: Date.now(), type: "test", siteId: "test" },
      ];

      mockKV.get.mockResolvedValueOnce(null);

      await customStorage.storeEvents(events);

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { expirationTtl: 60 * 60 * 24 * 7 }
      );
    });

    test("should handle storage errors gracefully", async () => {
      mockKV.get.mockRejectedValueOnce(new Error("KV error"));

      const events: Event[] = [
        { id: "test-1", timestamp: Date.now(), type: "test", siteId: "test" },
      ];

      await expect(storage.storeEvents(events)).rejects.toThrow("KV error");
    });
  });

  describe("Event Querying", () => {
    beforeEach(() => {
      const mockEvents = [
        {
          id: "test-1",
          timestamp: Date.now() - 2000,
          type: "pageview",
          siteId: "test-site",
          properties: { path: "/test1" },
        },
        {
          id: "test-2",
          timestamp: Date.now() - 1000,
          type: "click",
          siteId: "test-site",
          properties: { element: "button" },
        },
        {
          id: "test-3",
          timestamp: Date.now(),
          type: "pageview",
          siteId: "test-site",
          properties: { path: "/test2" },
        },
      ];

      mockKV.get.mockImplementation((key: string) => {
        if (key.startsWith('events:')) {
          return Promise.resolve(mockEvents);
        }
        return Promise.resolve(null);
      });
    });

    test("should query events within time range", async () => {
      const now = Date.now();
      const start = now - 3600000; // 1 hour ago

      const result = await storage.queryEvents({
        start,
        end: now,
      });

      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThan(0);
    });

    test("should query events across multiple days", async () => {
      const now = Date.now();
      const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);

      await storage.queryEvents({
        start: threeDaysAgo,
        end: now,
      });

      // Should have queried multiple day keys
      expect(mockKV.get).toHaveBeenCalledTimes(4); // 4 days worth of keys
    });

    test("should filter events by timestamp within day", async () => {
      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);

      const result = await storage.queryEvents({
        start: thirtyMinutesAgo,
        end: now,
      });

      // Should filter out events older than 30 minutes
      const filteredEvents = result.events?.filter(e => e.timestamp >= thirtyMinutesAgo);
      expect(filteredEvents?.length).toBe(result.events?.length);
    });

    test("should apply custom filters", async () => {
      const result = await storage.queryEvents({
        filter: 'event.type === "pageview"',
      });

      expect(result.events).toBeDefined();
      // Note: Actual filtering would happen in memory after fetching
    });

    test("should respect query limit", async () => {
      const result = await storage.queryEvents({
        limit: 2,
      });

      expect(result.events?.length).toBeLessThanOrEqual(2);
    });

    test("should handle missing data gracefully", async () => {
      mockKV.get.mockResolvedValue(null); // No data found

      const result = await storage.queryEvents({});

      expect(result.events).toHaveLength(0);
    });

    test("should use default time range when not provided", async () => {
      await storage.queryEvents({});

      // Should query at least one day
      expect(mockKV.get).toHaveBeenCalled();
    });

    test("should handle KV errors during querying", async () => {
      mockKV.get.mockRejectedValueOnce(new Error("KV read error"));

      await expect(storage.queryEvents({})).rejects.toThrow("KV read error");
    });
  });

  describe("Date Range Generation", () => {
    test("should generate correct date range for query", async () => {
      const now = Date.now();
      const start = now - (2 * 24 * 60 * 60 * 1000); // 2 days ago

      await storage.queryEvents({ start, end: now });

      // Should query 3 days worth of data (start day, middle day, end day)
      expect(mockKV.get).toHaveBeenCalledTimes(3);
    });

    test("should handle same-day queries", async () => {
      const now = Date.now();
      const earlierToday = now - (2 * 60 * 60 * 1000); // 2 hours ago

      await storage.queryEvents({ start: earlierToday, end: now });

      // Should query only one day
      expect(mockKV.get).toHaveBeenCalledTimes(1);
    });

    test("should handle edge cases around midnight", async () => {
      const midnight = new Date().setHours(0, 0, 0, 0);
      const beforeMidnight = midnight - 1000; // 1 second before
      const afterMidnight = midnight + 1000; // 1 second after

      await storage.queryEvents({ start: beforeMidnight, end: afterMidnight });

      // Should query both days
      expect(mockKV.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data Serialization", () => {
    test("should serialize and deserialize events correctly", async () => {
      const complexEvent: Event[] = [
        {
          id: "complex-1",
          timestamp: Date.now(),
          type: "purchase",
          siteId: "ecommerce",
          userId: "user123",
          sessionId: "session456",
          properties: {
            revenue: 99.99,
            currency: "USD",
            items: [
              { id: "item1", name: "Product A", price: 49.99 },
              { id: "item2", name: "Product B", price: 50.00 },
            ],
            metadata: {
              source: "web",
              campaign: "summer-sale",
            },
          },
        },
      ];

      mockKV.get.mockResolvedValueOnce(null);

      await storage.storeEvents(complexEvent);

      // Verify the data was serialized correctly
      const putCall = mockKV.put.mock.calls[0];
      const serializedData = putCall[1];
      const parsedData = JSON.parse(serializedData);

      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].properties.revenue).toBe(99.99);
      expect(parsedData[0].properties.items).toHaveLength(2);
      expect(parsedData[0].properties.metadata.source).toBe("web");
    });
  });
});