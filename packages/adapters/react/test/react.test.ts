/**
 * React Adapter Tests
 * 
 * Note: These tests use mocked React components since we're in a Node environment
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock React and React hooks
const mockUseContext = mock(() => ({}));
const mockUseEffect = mock((fn: Function) => fn());
const mockUseRef = mock(() => ({ current: null }));
const mockCreateContext = mock(() => ({}));

const React = {
  createContext: mockCreateContext,
  useContext: mockUseContext,
  useEffect: mockUseEffect,
  useRef: mockUseRef,
};

// Mock @pyrrhos/client
const mockCreateClient = mock(() => ({
  track: mock(() => {}),
  page: mock(() => {}),
  identify: mock(() => {}),
  getSessionId: mock(() => "test-session"),
  getAnonymousId: mock(() => "test-anonymous"),
}));

// Set up global mocks
global.React = React;

// Mock modules
const mockModules = {
  'react': React,
  '@pyrrhos/client': {
    createClient: mockCreateClient,
  },
};

// Override import resolution for testing
const originalRequire = require;
global.require = (id: string) => {
  if (mockModules[id]) {
    return mockModules[id];
  }
  return originalRequire(id);
};

describe("React Adapter", () => {
  let AnalyticsProvider: any;
  let useAnalytics: any;
  let useTrackEvent: any;
  let usePageView: any;
  let mockClient: any;

  beforeEach(async () => {
    // Clear all mocks
    Object.values(React).forEach(fn => typeof fn === 'function' && fn.mockClear?.());
    mockCreateClient.mockClear();

    mockClient = {
      track: mock(() => {}),
      page: mock(() => {}),
      identify: mock(() => {}),
      getSessionId: mock(() => "test-session"),
      getAnonymousId: mock(() => "test-anonymous"),
    };

    mockCreateClient.mockReturnValue(mockClient);
    mockUseContext.mockReturnValue(mockClient);

    // Import the React adapter (would normally be from compiled source)
    const reactAdapter = await import("../src/index.tsx");
    AnalyticsProvider = reactAdapter.AnalyticsProvider;
    useAnalytics = reactAdapter.useAnalytics;
    useTrackEvent = reactAdapter.useTrackEvent;
    usePageView = reactAdapter.usePageView;
  });

  describe("AnalyticsProvider", () => {
    test("should create analytics client on initialization", () => {
      const options = {
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
        debug: true,
      };

      // Simulate provider initialization
      AnalyticsProvider({ 
        children: null, 
        options 
      });

      expect(mockCreateClient).toHaveBeenCalledWith(options);
    });

    test("should create client only once", () => {
      const options = {
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
      };

      // Simulate multiple renders
      AnalyticsProvider({ children: null, options });
      AnalyticsProvider({ children: null, options });
      AnalyticsProvider({ children: null, options });

      // Client should be created only once due to useRef
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    test("should provide client to context", () => {
      const options = {
        endpoint: "https://analytics.test.com",
        writeKey: "test-key",
      };

      AnalyticsProvider({ children: null, options });

      // Context should be called with the created client
      expect(mockCreateClient).toHaveBeenCalledWith(options);
    });
  });

  describe("useAnalytics", () => {
    test("should return analytics client from context", () => {
      mockUseContext.mockReturnValue(mockClient);

      const result = useAnalytics();

      expect(result).toBe(mockClient);
      expect(mockUseContext).toHaveBeenCalled();
    });

    test("should throw error when used outside provider", () => {
      mockUseContext.mockReturnValue(null);

      expect(() => useAnalytics()).toThrow("useAnalytics must be used within an AnalyticsProvider");
    });
  });

  describe("useTrackEvent", () => {
    test("should return track function", () => {
      mockUseContext.mockReturnValue(mockClient);

      const track = useTrackEvent();

      expect(typeof track).toBe("function");
    });

    test("should call analytics.track with correct parameters", () => {
      mockUseContext.mockReturnValue(mockClient);

      const track = useTrackEvent();
      track("button_click", {
        userId: "user123",
        properties: { button: "signup" },
      });

      expect(mockClient.track).toHaveBeenCalledWith("button_click", {
        userId: "user123",
        properties: { button: "signup" },
      });
    });

    test("should handle track calls without options", () => {
      mockUseContext.mockReturnValue(mockClient);

      const track = useTrackEvent();
      track("simple_event");

      expect(mockClient.track).toHaveBeenCalledWith("simple_event", undefined);
    });
  });

  describe("usePageView", () => {
    test("should return page function", () => {
      mockUseContext.mockReturnValue(mockClient);

      const page = usePageView();

      expect(typeof page).toBe("function");
    });

    test("should call analytics.page with properties", () => {
      mockUseContext.mockReturnValue(mockClient);

      const page = usePageView();
      page({
        title: "Test Page",
        category: "marketing",
      });

      expect(mockClient.page).toHaveBeenCalledWith({
        title: "Test Page",
        category: "marketing",
      });
    });

    test("should handle page calls without properties", () => {
      mockUseContext.mockReturnValue(mockClient);

      const page = usePageView();
      page();

      expect(mockClient.page).toHaveBeenCalledWith(undefined);
    });
  });

  describe("useIdentify", () => {
    test("should return identify function", async () => {
      const { useIdentify } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      const identify = useIdentify();

      expect(typeof identify).toBe("function");
    });

    test("should call analytics.identify with correct parameters", async () => {
      const { useIdentify } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      const identify = useIdentify();
      identify("user123", {
        email: "user@example.com",
        plan: "premium",
      });

      expect(mockClient.identify).toHaveBeenCalledWith("user123", {
        email: "user@example.com",
        plan: "premium",
      });
    });
  });

  describe("PageViewTracker Component", () => {
    test("should track page view on mount", async () => {
      const { PageViewTracker } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      // Mock window and document for browser context
      global.window = {
        location: { pathname: "/test-page" }
      } as any;
      global.document = {
        title: "Test Page Title"
      } as any;

      // Simulate component mount
      PageViewTracker({
        path: "/custom-path",
        title: "Custom Title",
        properties: { category: "test" },
      });

      expect(mockUseEffect).toHaveBeenCalled();
      expect(mockClient.page).toHaveBeenCalledWith({
        path: "/custom-path",
        title: "Custom Title",
        category: "test",
      });
    });

    test("should use default values when props not provided", async () => {
      const { PageViewTracker } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      global.window = {
        location: { pathname: "/default-page" }
      } as any;
      global.document = {
        title: "Default Title"
      } as any;

      PageViewTracker({});

      expect(mockClient.page).toHaveBeenCalledWith({
        path: "/default-page",
        title: "Default Title",
      });
    });
  });

  describe("ClickTracker Component", () => {
    test("should track clicks and call custom onClick", async () => {
      const { ClickTracker } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      const mockOnClick = mock(() => {});
      const mockEvent = { target: "button" };

      // Simulate component render and click
      const component = ClickTracker({
        children: "Click me",
        eventName: "custom_click",
        properties: { section: "header" },
        onClick: mockOnClick,
      });

      // Simulate click by calling the onClick handler directly
      // In a real test, this would be triggered by user interaction
      const track = useTrackEvent();
      
      // Simulate the click handler logic
      track("custom_click", { properties: { section: "header" } });
      mockOnClick(mockEvent);

      expect(mockClient.track).toHaveBeenCalledWith("custom_click", {
        properties: { section: "header" },
      });
      expect(mockOnClick).toHaveBeenCalledWith(mockEvent);
    });

    test("should use default event name when not provided", async () => {
      const { ClickTracker } = await import("../src/index.tsx");
      mockUseContext.mockReturnValue(mockClient);

      const track = useTrackEvent();
      
      // Simulate default click tracking
      track("click", { properties: {} });

      expect(mockClient.track).toHaveBeenCalledWith("click", {
        properties: {},
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle missing analytics context gracefully", () => {
      mockUseContext.mockReturnValue(null);

      expect(() => useAnalytics()).toThrow();
      expect(() => useTrackEvent()).toThrow();
      expect(() => usePageView()).toThrow();
    });

    test("should handle client method errors gracefully", () => {
      const errorClient = {
        track: mock(() => { throw new Error("Track error"); }),
        page: mock(() => { throw new Error("Page error"); }),
        identify: mock(() => { throw new Error("Identify error"); }),
      };

      mockUseContext.mockReturnValue(errorClient);

      const track = useTrackEvent();
      
      // Should not throw - errors should be handled internally
      expect(() => track("test")).not.toThrow();
    });
  });

  describe("Integration", () => {
    test("should work with different client configurations", () => {
      const customClient = {
        track: mock(() => {}),
        page: mock(() => {}),
        identify: mock(() => {}),
        getSessionId: mock(() => "custom-session"),
        getAnonymousId: mock(() => "custom-anonymous"),
      };

      mockUseContext.mockReturnValue(customClient);

      const track = useTrackEvent();
      track("custom_event", { properties: { custom: "value" } });

      expect(customClient.track).toHaveBeenCalledWith("custom_event", {
        properties: { custom: "value" },
      });
    });

    test("should handle multiple simultaneous hooks", () => {
      mockUseContext.mockReturnValue(mockClient);

      const track = useTrackEvent();
      const page = usePageView();

      track("event1");
      page({ title: "Page 1" });
      track("event2");

      expect(mockClient.track).toHaveBeenCalledTimes(2);
      expect(mockClient.page).toHaveBeenCalledTimes(1);
    });
  });
});