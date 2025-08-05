import { describe, test, expect, beforeEach, mock } from "bun:test";
import { D1Storage } from "../src/index.ts";
import type { Event } from "@pyrrhos/core";

// Mock D1Database
const mockDatabase = {
  exec: mock(() => Promise.resolve()),
  prepare: mock(() => ({
    bind: mock(() => ({} as any)),
    all: mock(() => Promise.resolve({ results: [] })),
  })),
  batch: mock(() => Promise.resolve()),
};

describe("D1Storage", () => {
  let storage: ReturnType<typeof D1Storage>;

  beforeEach(() => {
    // Clear all mocks
    Object.values(mockDatabase).forEach(fn => fn.mockClear?.());
    mockDatabase.prepare.mockReturnValue({
      bind: mock(() => ({} as any)),
      all: mock(() => Promise.resolve({ results: [] })),
    });

    storage = D1Storage({ database: mockDatabase as any });
  });

  describe("Schema Initialization", () => {
    test("should initialize database schema on first storeEvents call", async () => {
      const events: Event[] = [
        {
          id: "test-1",
          timestamp: Date.now(),
          type: "pageview",
          siteId: "test-site",
          properties: { path: "/test" },
        },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS events")
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_timestamp")
      );
    });
  });

  describe("Event Storage", () => {
    test("should store single event", async () => {
      const events: Event[] = [
        {
          id: "test-1",
          timestamp: Date.now(),
          type: "pageview",
          siteId: "test-site",
          userId: "user123",
          sessionId: "session456",
          properties: { path: "/test" },
          ip: "192.168.1.1",
          ua: "Test Agent",
          referrer: "https://google.com",
          url: "https://example.com/test",
          language: "en-US",
          screenWidth: 1920,
          screenHeight: 1080,
        },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO events")
      );
      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    test("should store multiple events in batch", async () => {
      const events: Event[] = [
        { id: "test-1", timestamp: Date.now(), type: "pageview", siteId: "test" },
        { id: "test-2", timestamp: Date.now(), type: "click", siteId: "test" },
        { id: "test-3", timestamp: Date.now(), type: "form_submit", siteId: "test" },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.batch).toHaveBeenCalled();
      // Should prepare one statement and bind it multiple times
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(1);
    });

    test("should handle events with missing optional fields", async () => {
      const events: Event[] = [
        {
          id: "test-1",
          timestamp: Date.now(),
          type: "pageview",
          // Missing optional fields
        },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    test("should generate UUID for events without ID", async () => {
      const events: Event[] = [
        {
          timestamp: Date.now(),
          type: "pageview",
          siteId: "test",
          // No ID provided
        },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    test("should serialize properties as JSON", async () => {
      const events: Event[] = [
        {
          id: "test-1",
          timestamp: Date.now(),
          type: "pageview",
          siteId: "test",
          properties: {
            complex: {
              nested: "value",
              array: [1, 2, 3],
            },
          },
        },
      ];

      await storage.storeEvents(events);

      expect(mockDatabase.batch).toHaveBeenCalled();
    });
  });

  describe("Event Querying", () => {
    beforeEach(() => {
      const mockResults = [
        {
          id: "test-1",
          timestamp: Date.now() - 1000,
          type: "pageview",
          site_id: "test-site",
          user_id: "user123",
          session_id: "session456",
          properties: '{"path": "/test"}',
          ip: "192.168.1.1",
          ua: "Test Agent",
          referrer: "https://google.com",
          url: "https://example.com/test",
          language: "en-US",
          screen_width: 1920,
          screen_height: 1080,
        },
        {
          id: "test-2",
          timestamp: Date.now(),
          type: "click",
          site_id: "test-site",
          user_id: "user123",
          session_id: "session456",
          properties: '{"element": "button"}',
          ip: "192.168.1.1",
          ua: "Test Agent",
          referrer: null,
          url: "https://example.com/test",
          language: "en-US",
          screen_width: 1920,
          screen_height: 1080,
        },
      ];

      mockDatabase.prepare.mockReturnValue({
        bind: mock(() => ({
          all: mock(() => Promise.resolve({ results: mockResults })),
        })),
        all: mock(() => Promise.resolve({ results: mockResults })),
      });
    });

    test("should query events with time range", async () => {
      const now = Date.now();
      const start = now - 3600000; // 1 hour ago

      const result = await storage.queryEvents({
        start,
        end: now,
        limit: 1000,
      });

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE timestamp >= ? AND timestamp <= ?")
      );
      expect(result.events).toHaveLength(2);
      expect(result.events?.[0]?.type).toBe("pageview");
      expect(result.events?.[1]?.type).toBe("click");
    });

    test("should parse stored properties correctly", async () => {
      const result = await storage.queryEvents({});

      expect(result.events?.[0]?.properties).toEqual({ path: "/test" });
      expect(result.events?.[1]?.properties).toEqual({ element: "button" });
    });

    test("should convert database columns to event format", async () => {
      const result = await storage.queryEvents({});

      const event = result.events?.[0];
      expect(event?.siteId).toBe("test-site");
      expect(event?.userId).toBe("user123");
      expect(event?.sessionId).toBe("session456");
      expect(event?.screenWidth).toBe(1920);
      expect(event?.screenHeight).toBe(1080);
    });

    test("should calculate metrics", async () => {
      const result = await storage.queryEvents({});

      expect(result.metrics?.totalEvents).toBe(2);
      expect(result.metrics?.uniqueUsers).toBe(1);
      expect(result.metrics?.pageViews).toBe(1);
    });

    test("should apply custom filters", async () => {
      // Mock filtering - in real implementation this would be done in memory
      // after fetching from database
      const result = await storage.queryEvents({
        filter: 'event.type === "pageview"',
      });

      expect(mockDatabase.prepare).toHaveBeenCalled();
      expect(result.events).toBeDefined();
    });

    test("should use default values for query options", async () => {
      await storage.queryEvents({});

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT ?")
      );
    });

    test("should handle empty results", async () => {
      mockDatabase.prepare.mockReturnValue({
        bind: mock(() => ({
          all: mock(() => Promise.resolve({ results: [] })),
        })),
        all: mock(() => Promise.resolve({ results: [] })),
      });

      const result = await storage.queryEvents({});

      expect(result.events).toHaveLength(0);
      expect(result.metrics?.totalEvents).toBe(0);
      expect(result.metrics?.uniqueUsers).toBe(0);
      expect(result.metrics?.pageViews).toBe(0);
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors during storage", async () => {
      mockDatabase.batch.mockRejectedValueOnce(new Error("Database error"));

      const events: Event[] = [
        { id: "test-1", timestamp: Date.now(), type: "test", siteId: "test" },
      ];

      await expect(storage.storeEvents(events)).rejects.toThrow("Database error");
    });

    test("should handle database errors during querying", async () => {
      mockDatabase.prepare.mockReturnValue({
        bind: mock(() => ({
          all: mock(() => Promise.reject(new Error("Query error"))),
        })),
        all: mock(() => Promise.reject(new Error("Query error"))),
      });

      await expect(storage.queryEvents({})).rejects.toThrow("Query error");
    });

    test("should handle malformed JSON in properties", async () => {
      const mockResults = [
        {
          id: "test-1",
          timestamp: Date.now(),
          type: "pageview",
          site_id: "test",
          properties: 'invalid json{',
          // ... other fields
        },
      ];

      mockDatabase.prepare.mockReturnValue({
        bind: mock(() => ({
          all: mock(() => Promise.resolve({ results: mockResults })),
        })),
        all: mock(() => Promise.resolve({ results: mockResults })),
      });

      const result = await storage.queryEvents({});
      
      // Should handle JSON parse error gracefully
      expect(result.events?.[0]?.properties).toEqual({});
    });
  });
});