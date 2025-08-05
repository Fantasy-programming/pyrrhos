import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorage } from "../src/types.ts";
import type { Event } from "../src/types.ts";

describe("MemoryStorage", () => {
  let storage: ReturnType<typeof MemoryStorage>;

  beforeEach(() => {
    storage = MemoryStorage({ maxEvents: 100 });
  });

  test("should store and retrieve events", async () => {
    const events: Event[] = [
      {
        id: "test-1",
        timestamp: Date.now(),
        type: "pageview",
        siteId: "test-site",
        properties: { path: "/test" },
      },
      {
        id: "test-2", 
        timestamp: Date.now() + 1000,
        type: "click",
        siteId: "test-site",
        properties: { element: "button" },
      }
    ];

    await storage.storeEvents(events);

    const result = await storage.queryEvents({
      start: Date.now() - 1000,
      end: Date.now() + 2000,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events?.[0]?.type).toBe("click"); // Most recent first
    expect(result.events?.[1]?.type).toBe("pageview");
  });

  test("should respect maxEvents limit", async () => {
    const storage = MemoryStorage({ maxEvents: 3 });
    
    const events: Event[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      timestamp: Date.now() + i,
      type: "test",
      siteId: "test-site",
    }));

    await storage.storeEvents(events);

    const result = await storage.queryEvents({});
    expect(result.events).toHaveLength(3);
    
    // Should keep the most recent events
    expect(result.events?.[0]?.id).toBe("test-4");
    expect(result.events?.[1]?.id).toBe("test-3");
    expect(result.events?.[2]?.id).toBe("test-2");
  });

  test("should filter events by timestamp", async () => {
    const now = Date.now();
    const events: Event[] = [
      { id: "old", timestamp: now - 2000, type: "test", siteId: "test" },
      { id: "current", timestamp: now, type: "test", siteId: "test" },
      { id: "future", timestamp: now + 2000, type: "test", siteId: "test" },
    ];

    await storage.storeEvents(events);

    const result = await storage.queryEvents({
      start: now - 500,
      end: now + 500,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events?.[0]?.id).toBe("current");
  });

  test("should calculate metrics correctly", async () => {
    const events: Event[] = [
      { id: "1", timestamp: Date.now(), type: "pageview", siteId: "test", userId: "user1" },
      { id: "2", timestamp: Date.now(), type: "pageview", siteId: "test", userId: "user2" },
      { id: "3", timestamp: Date.now(), type: "click", siteId: "test", userId: "user1" },
    ];

    await storage.storeEvents(events);

    const result = await storage.queryEvents({});
    
    expect(result.metrics?.totalEvents).toBe(3);
    expect(result.metrics?.pageViews).toBe(2);
    expect(result.metrics?.uniqueUsers).toBe(2);
  });

  test("should handle empty queries", async () => {
    const result = await storage.queryEvents({});
    
    expect(result.events).toHaveLength(0);
    expect(result.metrics?.totalEvents).toBe(0);
    expect(result.metrics?.uniqueUsers).toBe(0);
    expect(result.metrics?.pageViews).toBe(0);
  });

  test("should apply custom filters", async () => {
    const events: Event[] = [
      { id: "1", timestamp: Date.now(), type: "pageview", siteId: "site1" },
      { id: "2", timestamp: Date.now(), type: "pageview", siteId: "site2" },
      { id: "3", timestamp: Date.now(), type: "click", siteId: "site1" },
    ];

    await storage.storeEvents(events);

    const result = await storage.queryEvents({
      filter: 'event.siteId === "site1"',
    });

    expect(result.events).toHaveLength(2);
    expect(result.events?.every(e => e.siteId === "site1")).toBe(true);
  });

  test("should handle invalid filters gracefully", async () => {
    const events: Event[] = [
      { id: "1", timestamp: Date.now(), type: "test", siteId: "test" },
    ];

    await storage.storeEvents(events);

    const result = await storage.queryEvents({
      filter: 'invalid syntax !!!',
    });

    // Should return all events if filter is invalid
    expect(result.events).toHaveLength(1);
  });

  test("should limit results", async () => {
    const events: Event[] = Array.from({ length: 10 }, (_, i) => ({
      id: `test-${i}`,
      timestamp: Date.now() + i,
      type: "test",
      siteId: "test",
    }));

    await storage.storeEvents(events);

    const result = await storage.queryEvents({ limit: 5 });

    expect(result.events).toHaveLength(5);
  });
});