import { describe, test, expect, beforeEach } from "bun:test";
import { openanalytics } from "../src";
import { MemoryStorage } from "../src/storage/memory";

describe("OpenAnalytics Collector", () => {
  let app: ReturnType<typeof openanalytics>;

  beforeEach(() => {
    app = openanalytics({
      storage: MemoryStorage({ maxEvents: 1000 }),
      writeKeys: ["test-key"],
      domains: ["*"],
    });
  });

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
      storage: MemoryStorage(),
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
      // Missing required fields
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

  test("should handle health check", async () => {
    const response = await app.fetch(new Request("http://localhost/health"));
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.status).toBe("ok");
    expect(typeof result.timestamp).toBe("number");
  });

  test("should provide metrics endpoint", async () => {
    // First, add some test data
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

    // Now query metrics
    const response = await app.fetch(new Request("http://localhost/api/v1/metrics", {
      headers: { "Authorization": "Bearer test-key" },
    }));

    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.metrics.totalEvents).toBe(3);
    expect(result.metrics.pageViews).toBe(2);
    expect(result.metrics.uniqueVisitors).toBe(2);
  });
});