import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { openanalytics, MemoryStorage } from "../src/index.ts";
import type { Event } from "../src/types.ts";

describe("Core Analytics Engine", () => {
  let app: ReturnType<typeof openanalytics>;
  let storage: ReturnType<typeof MemoryStorage>;

  beforeEach(() => {
    storage = MemoryStorage({ maxEvents: 1000 });
    app = openanalytics({
      storage,
      writeKeys: ["test-key"],
      domains: ["*"],
    });
  });

  describe("Event Collection", () => {
    test("should accept valid events", async () => {
      const event = {
        type: "pageview",
        siteId: "test-site",
        properties: {
          path: "/test",
          title: "Test Page",
        },
      };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify(event),
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.processed).toBe(1);
    });

    test("should accept batch events", async () => {
      const events = [
        { type: "pageview", siteId: "test", properties: { path: "/page1" } },
        { type: "pageview", siteId: "test", properties: { path: "/page2" } },
        { type: "click", siteId: "test", properties: { element: "button" } },
      ];

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({ batch: events }),
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.processed).toBe(3);
    });

    test("should reject unauthorized requests", async () => {
      const event = { type: "test", siteId: "test" };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }));

      expect(response.status).toBe(401);
    });

    test("should reject requests with invalid API key", async () => {
      const event = { type: "test", siteId: "test" };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid-key",
        },
        body: JSON.stringify(event),
      }));

      expect(response.status).toBe(401);
    });

    test("should respect DNT header", async () => {
      const app = openanalytics({
        storage,
        privacy: { respectDNT: true },
      });

      const event = { type: "test", siteId: "test" };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DNT": "1",
        },
        body: JSON.stringify(event),
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ignored");
      expect(result.reason).toBe("DNT enabled");
    });

    test("should validate event data", async () => {
      const invalidEvent = {
        properties: { test: "value" },
      };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify(invalidEvent),
      }));

      expect(response.status).toBe(400);
    });

    test("should reject events that are too old", async () => {
      const oldEvent = {
        type: "test",
        siteId: "test", 
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
      };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify(oldEvent),
      }));

      expect(response.status).toBe(400);
    });

    test("should respect batch size limits", async () => {
      const largeEventsBatch = Array.from({ length: 101 }, (_, i) => ({
        type: "test",
        siteId: "test",
        properties: { index: i },
      }));

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({ batch: largeEventsBatch }),
      }));

      expect(response.status).toBe(413);
    });

    test("should apply sampling", async () => {
      const app = openanalytics({
        storage,
        sample: 0, // 0% sampling - should ignore all events
        writeKeys: ["test-key"],
      });

      const event = { type: "test", siteId: "test" };

      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify(event),
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("sampled");
    });
  });

  describe("Query API", () => {
    beforeEach(async () => {
      // Add test data
      const events = [
        { type: "pageview", siteId: "test", sessionId: "session1", timestamp: Date.now() - 3600000 },
        { type: "pageview", siteId: "test", sessionId: "session2", timestamp: Date.now() - 1800000 },
        { type: "click", siteId: "test", sessionId: "session1", timestamp: Date.now() - 900000 },
      ];

      await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({ batch: events }),
      }));
    });

    test("should provide query endpoint", async () => {
      const response = await app.fetch(new Request("http://localhost/api/v1/query", {
        headers: { "Authorization": "Bearer test-key" },
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.events).toBeDefined();
      expect(result.events.length).toBe(3);
    });

    test("should filter events by time range", async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      
      const response = await app.fetch(new Request(
        `http://localhost/api/v1/query?start=${oneHourAgo}&end=${now}`,
        { headers: { "Authorization": "Bearer test-key" } }
      ));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.events.length).toBeGreaterThanOrEqual(2);
    });

    test("should respect query limits", async () => {
      const response = await app.fetch(new Request(
        "http://localhost/api/v1/query?limit=1",
        { headers: { "Authorization": "Bearer test-key" } }
      ));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.events.length).toBe(1);
    });
  });

  describe("Metrics API", () => {
    beforeEach(async () => {
      // Add test data
      const events = [
        { type: "pageview", siteId: "test", sessionId: "session1" },
        { type: "pageview", siteId: "test", sessionId: "session2" },
        { type: "click", siteId: "test", sessionId: "session1" },
      ];

      await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({ batch: events }),
      }));
    });

    test("should provide metrics endpoint", async () => {
      const response = await app.fetch(new Request("http://localhost/api/v1/metrics", {
        headers: { "Authorization": "Bearer test-key" },
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.metrics.totalEvents).toBe(3);
      expect(result.metrics.pageViews).toBe(2);
      expect(result.metrics.uniqueVisitors).toBe(2);
    });

    test("should calculate bounce rate", async () => {
      const response = await app.fetch(new Request("http://localhost/api/v1/metrics", {
        headers: { "Authorization": "Bearer test-key" },
      }));

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.metrics.bounceRate).toBeDefined();
      expect(typeof result.metrics.bounceRate).toBe("number");
    });
  });

  describe("Health Check", () => {
    test("should provide health check", async () => {
      const response = await app.fetch(new Request("http://localhost/health"));
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(typeof result.timestamp).toBe("number");
    });
  });

  describe("Event Processing", () => {
    test("should apply custom event processing", async () => {
      const processedEvents: Event[] = [];
      
      const app = openanalytics({
        storage,
        writeKeys: ["test-key"],
        processEvents: async (events) => {
          const processed = events.map(event => ({
            ...event,
            properties: {
              ...event.properties,
              processed: true,
            },
          }));
          processedEvents.push(...processed);
          return processed;
        },
      });

      const event = { type: "test", siteId: "test", properties: { original: true } };

      await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify(event),
      }));

      expect(processedEvents).toHaveLength(1);
      expect(processedEvents[0]?.properties.processed).toBe(true);
      expect(processedEvents[0]?.properties.original).toBe(true);
    });
  });

  describe("CORS", () => {
    test("should handle CORS preflight requests", async () => {
      const response = await app.fetch(new Request("http://localhost/api/v1/events", {
        method: "OPTIONS",
        headers: {
          "Origin": "https://example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type,Authorization",
        },
      }));

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });
});