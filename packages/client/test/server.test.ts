import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { createServerClient } from "../src/server.ts";

// Mock fetch globally
const fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
global.fetch = fetchMock;

describe("Server Client", () => {
  let client: ReturnType<typeof createServerClient>;

  beforeEach(() => {
    client = createServerClient({
      endpoint: "https://analytics.test.com",
      writeKey: "test-key",
      debug: false,
    });
    
    fetchMock.mockClear();
  });

  afterEach(() => {
    fetchMock.mockClear();
  });

  describe("Track Single Event", () => {
    test("should send event with correct payload", async () => {
      await client.track("purchase", {
        userId: "user123",
        properties: {
          revenue: 99.99,
          currency: "USD",
        },
        timestamp: 1234567890,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://analytics.test.com/api/v1/events");
      expect(options.method).toBe("POST");
      expect(options.headers["Authorization"]).toBe("Bearer test-key");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.type).toBe("purchase");
      expect(body.userId).toBe("user123");
      expect(body.properties.revenue).toBe(99.99);
      expect(body.timestamp).toBe(1234567890);
      expect(body.id).toBeDefined();
    });

    test("should handle server errors", async () => {
      fetchMock.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

      await expect(client.track("test", {})).rejects.toThrow("HTTP 500: Internal Server Error");
    });

    test("should use current timestamp if not provided", async () => {
      const beforeCall = Date.now();
      await client.track("test", {});
      const afterCall = Date.now();

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(body.timestamp).toBeLessThanOrEqual(afterCall);
    });

    test("should generate unique IDs", async () => {
      await client.track("test1", {});
      await client.track("test2", {});

      const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
      const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
      
      expect(body1.id).toBeDefined();
      expect(body2.id).toBeDefined();
      expect(body1.id).not.toBe(body2.id);
    });
  });

  describe("Batch Events", () => {
    test("should send batch with correct format", async () => {
      await client.batch([
        {
          type: "pageview",
          properties: { path: "/home" },
        },
        {
          type: "click",
          properties: { element: "button" },
          userId: "user123",
        },
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.batch).toHaveLength(2);
      expect(body.batch[0].type).toBe("pageview");
      expect(body.batch[1].type).toBe("click");
      expect(body.batch[1].userId).toBe("user123");
    });

    test("should handle empty batch", async () => {
      await client.batch([]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.batch).toHaveLength(0);
    });
  });

  describe("Debug Mode", () => {
    test("should log events in debug mode", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
      
      const debugClient = createServerClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        debug: true,
      });

      await debugClient.track("test", {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[OpenAnalytics] Tracking server event:")
      );
      
      consoleSpy.mockRestore();
    });

    test("should log batch events in debug mode", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
      
      const debugClient = createServerClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        debug: true,
      });

      await debugClient.batch([{ type: "test" }]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[OpenAnalytics] Tracking server batch:")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    test("should handle network errors", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.track("test", {})).rejects.toThrow("Network error");
    });

    test("should handle non-200 responses", async () => {
      fetchMock.mockResolvedValueOnce(new Response("Bad Request", { status: 400, statusText: "Bad Request" }));

      await expect(client.track("test", {})).rejects.toThrow("HTTP 400: Bad Request");
    });

    test("should handle authentication errors", async () => {
      fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }));

      await expect(client.track("test", {})).rejects.toThrow("HTTP 401: Unauthorized");
    });
  });

  describe("Event Data Handling", () => {
    test("should include all optional fields", async () => {
      await client.track("test", {
        userId: "user123",
        sessionId: "session456",
        anonymousId: "anon789",
        properties: { custom: "value" },
        timestamp: 1234567890,
        ip: "192.168.1.1",
        userAgent: "Test Agent",
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.userId).toBe("user123");
      expect(body.sessionId).toBe("session456");
      expect(body.anonymousId).toBe("anon789");
      expect(body.properties.custom).toBe("value");
      expect(body.ip).toBe("192.168.1.1");
      expect(body.ua).toBe("Test Agent");
    });

    test("should handle missing optional fields", async () => {
      await client.track("test", {});

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.userId).toBeUndefined();
      expect(body.sessionId).toBeUndefined();
      expect(body.properties).toEqual({});
    });

    test("should preserve custom properties", async () => {
      const customProps = {
        revenue: 99.99,
        currency: "USD",
        items: ["item1", "item2"],
        metadata: { source: "api" },
      };

      await client.track("purchase", { properties: customProps });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.properties).toEqual(customProps);
    });
  });
});