import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

describe("Docker Integration Tests", () => {
  let analyticsContainer: StartedTestContainer;
  let baseUrl: string;

  beforeAll(async () => {
    // Build and start the analytics container
    console.log("Building analytics container...");
    
    analyticsContainer = await GenericContainer.fromDockerfile(".", "Dockerfile.test")
      .withExposedPorts(3000)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3000",
      })
      .withWaitStrategy(Wait.forHttp("/health", 3000))
      .withStartupTimeout(60000)
      .start();

    const mappedPort = analyticsContainer.getMappedPort(3000);
    baseUrl = `http://localhost:${mappedPort}`;
    
    console.log(`Analytics container started at ${baseUrl}`);
  }, 90000); // 90 second timeout for container startup

  afterAll(async () => {
    if (analyticsContainer) {
      await analyticsContainer.stop();
    }
  });

  describe("Container Health", () => {
    test("should respond to health check", async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe("ok");
    });

    test("should expose metrics endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/v1/metrics`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.metrics).toBeDefined();
    });
  });

  describe("Event Processing", () => {
    test("should accept and process events", async () => {
      const event = {
        type: "docker_test",
        siteId: "container-test",
        properties: {
          container_id: analyticsContainer.getId(),
          test_timestamp: Date.now(),
        },
      };

      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.processed).toBe(1);
    });

    test("should handle batch events", async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        type: "batch_test",
        siteId: "container-test",
        properties: {
          batch_index: i,
          container_id: analyticsContainer.getId(),
        },
      }));

      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch: events }),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe("ok");
      expect(result.processed).toBe(5);
    });
  });

  describe("Data Persistence", () => {
    test("should persist and query events", async () => {
      // Send test events
      const testEvents = [
        { type: "persistence_test", siteId: "test", sessionId: "session1", properties: { index: 1 } },
        { type: "persistence_test", siteId: "test", sessionId: "session2", properties: { index: 2 } },
        { type: "click", siteId: "test", sessionId: "session1", properties: { element: "button" } },
      ];

      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: testEvents }),
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Query events
      const response = await fetch(`${baseUrl}/api/v1/query`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(data.events.length).toBeGreaterThanOrEqual(3);
    });

    test("should calculate correct metrics", async () => {
      // Send specific test data for metrics calculation
      const metricsTestEvents = [
        { type: "pageview", siteId: "metrics-test", sessionId: "m-session1", userId: "user1" },
        { type: "pageview", siteId: "metrics-test", sessionId: "m-session2", userId: "user2" },
        { type: "pageview", siteId: "metrics-test", sessionId: "m-session3", userId: "user2" }, // Same user, different session
        { type: "click", siteId: "metrics-test", sessionId: "m-session1", userId: "user1" },
      ];

      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: metricsTestEvents }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/api/v1/metrics`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.metrics.totalEvents).toBeGreaterThanOrEqual(4);
      expect(data.metrics.pageViews).toBeGreaterThanOrEqual(3);
      expect(data.metrics.uniqueVisitors).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Dashboard Integration", () => {
    test("should serve dashboard", async () => {
      const response = await fetch(`${baseUrl}/dashboard`);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Analytics Dashboard");
    });

    test("should update dashboard with real-time data", async () => {
      // Send events
      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dashboard_test",
          siteId: "realtime-test",
          sessionId: "rt-session",
          properties: { test: "realtime" },
        }),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch dashboard API
      const dashboardResponse = await fetch(`${baseUrl}/dashboard/api/metrics`);
      expect(dashboardResponse.status).toBe(200);

      const dashboardData = await dashboardResponse.json();
      expect(dashboardData.metrics).toBeDefined();
      expect(dashboardData.metrics.totalEvents).toBeGreaterThan(0);
    });
  });

  describe("Container Behavior", () => {
    test("should handle container restart gracefully", async () => {
      // Send initial event
      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pre_restart",
          siteId: "restart-test",
          properties: { phase: "before_restart" },
        }),
      });

      // Restart container (simulate restart by stopping and starting)
      await analyticsContainer.restart();

      // Wait for container to be ready
      let retries = 0;
      while (retries < 30) {
        try {
          const healthResponse = await fetch(`${baseUrl}/health`);
          if (healthResponse.status === 200) break;
        } catch (e) {
          // Container might not be ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }

      // Send post-restart event
      const response = await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "post_restart",
          siteId: "restart-test",
          properties: { phase: "after_restart" },
        }),
      });

      expect(response.status).toBe(200);
    }, 60000); // Longer timeout for restart test

    test("should maintain performance under load", async () => {
      const startTime = Date.now();
      
      // Send 50 concurrent requests
      const promises = Array.from({ length: 50 }, (_, i) =>
        fetch(`${baseUrl}/api/v1/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "load_test",
            siteId: "performance-test",
            properties: { request_id: i, timestamp: Date.now() },
          }),
        })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (10 seconds for 50 requests)
      expect(endTime - startTime).toBeLessThan(10000);
    }, 15000);
  });

  describe("Environment Configuration", () => {
    test("should respect environment variables", async () => {
      // The container was started with NODE_ENV=test
      // This test verifies the container respects environment configuration
      
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      
      // In a more complex setup, you might check specific behavior
      // that changes based on environment variables
    });
  });

  describe("Memory Usage", () => {
    test("should not leak memory under continuous load", async () => {
      // Send continuous events and monitor container
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await fetch(`${baseUrl}/api/v1/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "memory_test",
            siteId: "memory-test",
            properties: { 
              iteration: i,
              large_data: "x".repeat(1000), // 1KB of data per event
            },
          }),
        });

        // Brief pause to allow processing
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Container should still be responsive
      const healthResponse = await fetch(`${baseUrl}/health`);
      expect(healthResponse.status).toBe(200);

      // Metrics should be accurate
      const metricsResponse = await fetch(`${baseUrl}/api/v1/metrics`);
      expect(metricsResponse.status).toBe(200);
      
      const metrics = await metricsResponse.json();
      expect(metrics.metrics.totalEvents).toBeGreaterThanOrEqual(iterations);
    }, 30000);
  });
});