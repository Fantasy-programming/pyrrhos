import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { openanalytics } from "../src";
import { MemoryStorage } from "../src/storage/memory";

describe("Dashboard Integration", () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    const app = openanalytics({
      storage: MemoryStorage({ maxEvents: 1000 }),
      writeKeys: ["test-key"],
      dashboard: {
        enabled: true,
        path: "/dashboard",
        apiKey: "dashboard-key",
        title: "Test Dashboard",
      },
    });

    server = Bun.serve({
      port: 0, // Random available port
      fetch: app.fetch,
    });

    baseUrl = `http://localhost:${server.port}`;

    // Add some test data
    const testEvents = [
      {
        type: "pageview",
        siteId: "test-site",
        sessionId: "session1",
        timestamp: Date.now() - 3600000, // 1 hour ago
        properties: { path: "/home", title: "Home" },
      },
      {
        type: "pageview", 
        siteId: "test-site",
        sessionId: "session2",
        timestamp: Date.now() - 1800000, // 30 minutes ago
        properties: { path: "/about", title: "About" },
      },
      {
        type: "click",
        siteId: "test-site", 
        sessionId: "session1",
        timestamp: Date.now() - 900000, // 15 minutes ago
        properties: { element: "button", text: "Sign Up" },
      },
    ];

    const response = await fetch(`${baseUrl}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-key",
      },
      body: JSON.stringify({ batch: testEvents }),
    });

    expect(response.status).toBe(200);
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  test("should require authentication for dashboard", async () => {
    const response = await fetch(`${baseUrl}/dashboard`);
    expect(response.status).toBe(401);
  });

  test("should serve dashboard with valid API key", async () => {
    const response = await fetch(`${baseUrl}/dashboard?key=dashboard-key`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    
    const html = await response.text();
    expect(html).toContain("Test Dashboard");
    expect(html).toContain("Page Views");
    expect(html).toContain("Unique Visitors");
  });

  test("should serve dashboard metrics API", async () => {
    const response = await fetch(`${baseUrl}/dashboard/api/metrics?key=dashboard-key`);
    expect(response.status).toBe(200);
    
    const metrics = await response.json();
    expect(metrics.metrics.totalEvents).toBe(3);
    expect(metrics.metrics.pageViews).toBe(2);
    expect(metrics.metrics.uniqueVisitors).toBe(2);
  });

  test("should support different time ranges", async () => {
    const response = await fetch(
      `${baseUrl}/dashboard?key=dashboard-key&range=1h`
    );
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain("Test Dashboard");
  });

  test("should support theme parameter", async () => {
    const response = await fetch(
      `${baseUrl}/dashboard?key=dashboard-key&theme=dark`
    );
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain("#0f172a"); // Dark theme background color
  });

  test("should handle dashboard errors gracefully", async () => {
    // Create app with broken storage to test error handling
    const brokenApp = openanalytics({
      storage: {
        storeEvents: async () => { throw new Error("Storage error"); },
        queryEvents: async () => { throw new Error("Storage error"); },
      },
      dashboard: {
        enabled: true,
        path: "/dashboard",
        apiKey: "test-key",
      },
    });

    const brokenServer = Bun.serve({
      port: 0,
      fetch: brokenApp.fetch,
    });

    try {
      const response = await fetch(
        `http://localhost:${brokenServer.port}/dashboard?key=test-key`
      );
      expect(response.status).toBe(500);
      
      const html = await response.text();
      expect(html).toContain("Dashboard Error");
    } finally {
      brokenServer.stop();
    }
  });
});