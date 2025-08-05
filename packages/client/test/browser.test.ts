/**
 * Browser Client Tests
 * 
 * Note: These tests mock browser APIs since we're running in Node/Bun environment
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

// Mock browser globals
const mockWindow = {
  location: {
    href: "https://example.com/test-page",
    pathname: "/test-page",
    search: "?param=value",
    hash: "#section",
  },
  history: {
    pushState: mock(() => {}),
    replaceState: mock(() => {}),
  },
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
  setTimeout: mock((fn: Function, delay: number) => setTimeout(fn, delay)),
  clearTimeout: mock(clearTimeout),
  screen: { width: 1920, height: 1080 },
  innerWidth: 1200,
  innerHeight: 800,
  scrollY: 0,
};

const mockDocument = {
  title: "Test Page",
  referrer: "https://google.com",
  cookie: "",
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
  documentElement: {
    scrollHeight: 2000,
  },
};

const mockNavigator = {
  doNotTrack: "0",
  language: "en-US",
  userAgent: "Mozilla/5.0 (Test) AppleWebKit/537.36",
  sendBeacon: mock(() => true),
};

const mockLocalStorage = {
  getItem: mock(() => null),
  setItem: mock(() => {}),
  removeItem: mock(() => {}),
};

const mockFetch = mock(() => Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));

// Set up global mocks
global.window = mockWindow as any;
global.document = mockDocument as any;
global.navigator = mockNavigator as any;
global.localStorage = mockLocalStorage as any;
global.fetch = mockFetch;
global.crypto = { randomUUID: () => "test-uuid-" + Math.random() } as any;

// Import after mocks are set up
const { createClient } = await import("../src/browser.ts");

describe("Browser Client", () => {
  beforeEach(() => {
    // Reset all mocks
    Object.values(mockWindow).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
    Object.values(mockDocument).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
    Object.values(mockNavigator).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
    Object.values(mockLocalStorage).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
    mockFetch.mockClear();
  });

  describe("Client Initialization", () => {
    test("should create client with default options", () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
      });

      expect(client).toBeDefined();
      expect(typeof client.track).toBe("function");
      expect(typeof client.page).toBe("function");
    });

    test("should respect Do Not Track", () => {
      mockNavigator.doNotTrack = "1";
      
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        privacy: { respectDNT: true },
      });

      // Should return no-op client
      client.track("test", {});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should respect sampling", () => {
      // Mock Math.random to always return 0.9 (above 0.5 sample rate)
      const originalRandom = Math.random;
      Math.random = () => 0.9;

      try {
        const client = createClient({
          endpoint: "https://analytics.test.com",
          writeKey: "test-key",
          sample: 0.5, // 50% sampling
        });

        // Should return no-op client due to sampling
        client.track("test", {});
        expect(mockFetch).not.toHaveBeenCalled();
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe("Event Tracking", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        debug: false,
        batchSize: 1, // Send immediately for testing
        flushInterval: 100,
      });
    });

    test("should track custom events", async () => {
      client.track("button_click", {
        properties: {
          button_text: "Sign Up",
          page: "/landing",
        },
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://analytics.test.com/api/v1/events");
      
      const body = JSON.parse(options.body);
      expect(body.batch[0].type).toBe("button_click");
      expect(body.batch[0].properties.button_text).toBe("Sign Up");
    });

    test("should track page views", async () => {
      client.page({
        title: "Custom Title",
        category: "marketing",
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.batch[0].type).toBe("page_view");
      expect(body.batch[0].properties.title).toBe("Custom Title");
      expect(body.batch[0].properties.category).toBe("marketing");
    });

    test("should identify users", async () => {
      client.identify("user123", {
        email: "user@example.com",
        plan: "premium",
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.batch[0].type).toBe("identify");
      expect(body.batch[0].userId).toBe("user123");
      expect(body.batch[0].properties.email).toBe("user@example.com");
    });
  });

  describe("Session Management", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
      });
    });

    test("should generate session ID", () => {
      const sessionId = client.getSessionId();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test("should generate anonymous ID", () => {
      const anonymousId = client.getAnonymousId();
      expect(anonymousId).toBeDefined();
      expect(typeof anonymousId).toBe("string");
      expect(anonymousId.length).toBeGreaterThan(0);
    });

    test("should reset session", () => {
      const originalSessionId = client.getSessionId();
      const originalAnonymousId = client.getAnonymousId();

      client.reset();

      const newSessionId = client.getSessionId();
      const newAnonymousId = client.getAnonymousId();

      expect(newSessionId).not.toBe(originalSessionId);
      expect(newAnonymousId).not.toBe(originalAnonymousId);
    });
  });

  describe("Privacy Controls", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        batchSize: 1,
      });
    });

    test("should handle opt-out", async () => {
      expect(client.isOptedOut()).toBe(false);

      client.optOut();
      expect(client.isOptedOut()).toBe(true);

      // Events should not be sent when opted out
      client.track("test", {});
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should handle opt-in", () => {
      client.optOut();
      expect(client.isOptedOut()).toBe(true);

      client.optIn();
      expect(client.isOptedOut()).toBe(false);
    });
  });

  describe("Batching", () => {
    test("should batch events", async () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        batchSize: 3,
        flushInterval: 1000,
      });

      // Send 2 events (below batch size)
      client.track("event1", {});
      client.track("event2", {});

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockFetch).not.toHaveBeenCalled();

      // Send 3rd event (reaches batch size)
      client.track("event3", {});

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.batch).toHaveLength(3);
    });

    test("should flush events manually", async () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        batchSize: 10,
        flushInterval: 10000,
      });

      client.track("event1", {});
      client.track("event2", {});

      await client.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.batch).toHaveLength(2);
    });
  });

  describe("Auto-tracking", () => {
    test("should auto-track page views", () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        autoTrack: { pageViews: true },
        batchSize: 1,
      });

      // Should have tracked initial page view
      expect(mockFetch).toHaveBeenCalled();
    });

    test("should setup click tracking", () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        autoTrack: { clicks: true },
      });

      expect(mockDocument.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });

    test("should setup form tracking", () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        autoTrack: { forms: true },
      });

      expect(mockDocument.addEventListener).toHaveBeenCalledWith("submit", expect.any(Function));
    });

    test("should setup scroll tracking", () => {
      const client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        autoTrack: { scrollDepth: true },
      });

      expect(mockWindow.addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    });
  });

  describe("Error Handling", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        batchSize: 1,
      });
    });

    test("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      expect(() => client.track("test", {})).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Events should be re-queued for retry
      expect(mockFetch).toHaveBeenCalled();
    });

    test("should handle server errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

      expect(() => client.track("test", {})).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Context Data", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        batchSize: 1,
      });
    });

    test("should include context data in events", async () => {
      client.track("test", {});

      await new Promise(resolve => setTimeout(resolve, 50));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = body.batch[0];
      
      expect(event.context.url).toBe("https://example.com/test-page");
      expect(event.context.referrer).toBe("https://google.com");
      expect(event.context.language).toBe("en-US");
      expect(event.context.screenWidth).toBe(1920);
      expect(event.context.screenHeight).toBe(1080);
    });
  });
});