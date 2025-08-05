import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import puppeteer, { Browser, Page } from "puppeteer";
import { openanalytics, MemoryStorage } from "../packages/core/src/index.ts";

describe("E2E Analytics Tests", () => {
  let browser: Browser;
  let page: Page;
  let server: any;
  let analytics: ReturnType<typeof openanalytics>;
  let storage: ReturnType<typeof MemoryStorage>;
  let baseUrl: string;

  beforeAll(async () => {
    // Start test server
    storage = MemoryStorage({ maxEvents: 10000 });
    analytics = openanalytics({
      storage,
      writeKeys: ["test-key"],
      domains: ["*"],
      dashboard: {
        enabled: true,
        path: "/dashboard",
        apiKey: "dashboard-key",
        title: "E2E Test Dashboard",
      },
    });

    server = Bun.serve({
      port: 0, // Use random available port
      fetch: analytics.fetch,
    });

    baseUrl = `http://localhost:${server.port}`;

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    });
  });

  afterAll(async () => {
    if (server) {
      server.stop();
    }
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Enable console logging for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser Console Error:', msg.text());
      }
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      console.error('Page Error:', error.message);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe("Server Health", () => {
    test("should respond to health check", async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(typeof data.timestamp).toBe("number");
    });
  });

  describe("Dashboard Access", () => {
    test("should require authentication for dashboard", async () => {
      const response = await page.goto(`${baseUrl}/dashboard`);
      expect(response?.status()).toBe(401);
    });

    test("should serve dashboard with valid API key", async () => {
      const response = await page.goto(`${baseUrl}/dashboard?key=dashboard-key`);
      expect(response?.status()).toBe(200);
      
      await page.waitForSelector('h1', { timeout: 5000 });
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toContain("E2E Test Dashboard");
    });

    test("should display metrics in dashboard", async () => {
      // First, send some test events
      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({
          batch: [
            { type: "pageview", siteId: "test", sessionId: "session1", properties: { path: "/home" } },
            { type: "pageview", siteId: "test", sessionId: "session2", properties: { path: "/about" } },
            { type: "click", siteId: "test", sessionId: "session1", properties: { element: "button" } },
          ],
        }),
      });

      // Wait a bit for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load dashboard
      await page.goto(`${baseUrl}/dashboard?key=dashboard-key`);
      
      // Wait for metrics to load
      await page.waitForSelector('.metrics-grid', { timeout: 10000 });
      
      // Check if metrics are displayed
      const metricsCards = await page.$$('.metrics-grid > div');
      expect(metricsCards.length).toBeGreaterThan(0);
    });
  });

  describe("Browser Client Integration", () => {
    test("should load and initialize browser client", async () => {
      // Create a test page with our browser client
      const testPageHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>E2E Test Page</title>
        </head>
        <body>
          <h1>Test Page</h1>
          <button id="track-btn">Track Event</button>
          <script type="module">
            // Inline client implementation for testing
            class TestAnalytics {
              constructor(options) {
                this.endpoint = options.endpoint;
                this.writeKey = options.writeKey;
                this.events = [];
                this.debug = options.debug || false;
              }
              
              track(eventType, options = {}) {
                const event = {
                  id: 'test-' + Math.random().toString(36).substr(2, 9),
                  timestamp: Date.now(),
                  type: eventType,
                  properties: options.properties || {},
                  context: {
                    url: window.location.href,
                    title: document.title,
                    userAgent: navigator.userAgent,
                  }
                };
                
                this.events.push(event);
                if (this.debug) console.log('Tracked event:', event);
                
                return fetch(this.endpoint + '/api/v1/events', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.writeKey,
                  },
                  body: JSON.stringify(event),
                });
              }
              
              page(properties = {}) {
                return this.track('page_view', {
                  properties: {
                    title: document.title,
                    path: window.location.pathname,
                    ...properties,
                  }
                });
              }
            }
            
            window.analytics = new TestAnalytics({
              endpoint: '${baseUrl}',
              writeKey: 'test-key',
              debug: true,
            });
            
            // Track initial page view
            window.analytics.page();
            
            // Set up button click tracking
            document.getElementById('track-btn').addEventListener('click', () => {
              window.analytics.track('button_click', {
                properties: {
                  button_id: 'track-btn',
                  button_text: 'Track Event',
                }
              });
            });
            
            window.testComplete = true;
          </script>
        </body>
        </html>
      `;

      await page.setContent(testPageHtml);
      
      // Wait for client to initialize
      await page.waitForFunction(() => window.testComplete === true, { timeout: 5000 });
      
      // Verify initial page view was tracked
      const initialEvents = await page.evaluate(() => window.analytics.events.length);
      expect(initialEvents).toBe(1);
      
      // Click the button to track an event
      await page.click('#track-btn');
      
      // Wait for event to be tracked
      await page.waitForFunction(() => window.analytics.events.length === 2, { timeout: 2000 });
      
      const finalEvents = await page.evaluate(() => window.analytics.events.length);
      expect(finalEvents).toBe(2);
      
      // Verify the events were sent to server
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const serverEvents = await storage.queryEvents({});
      expect(serverEvents.events!.length).toBeGreaterThanOrEqual(2);
    });

    test("should track page navigation in SPA", async () => {
      const spaHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SPA Test</title>
        </head>
        <body>
          <div id="content">
            <h1>Home Page</h1>
            <nav>
              <a href="#" id="page1-link" data-page="page1">Page 1</a>
              <a href="#" id="page2-link" data-page="page2">Page 2</a>
            </nav>
          </div>
          <script type="module">
            class SPAAnalytics {
              constructor(options) {
                this.endpoint = options.endpoint;
                this.writeKey = options.writeKey;
                this.pageViews = [];
                this.setupNavigation();
              }
              
              track(eventType, options = {}) {
                const event = {
                  id: 'spa-' + Math.random().toString(36).substr(2, 9),
                  timestamp: Date.now(),
                  type: eventType,
                  properties: options.properties || {},
                };
                
                if (eventType === 'page_view') {
                  this.pageViews.push(event);
                }
                
                return fetch(this.endpoint + '/api/v1/events', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.writeKey,
                  },
                  body: JSON.stringify(event),
                });
              }
              
              setupNavigation() {
                // Track initial page
                this.track('page_view', {
                  properties: { page: 'home', path: '/' }
                });
                
                // Set up navigation tracking
                document.addEventListener('click', (e) => {
                  if (e.target.dataset.page) {
                    e.preventDefault();
                    const page = e.target.dataset.page;
                    
                    // Simulate SPA navigation
                    document.getElementById('content').innerHTML = 
                      '<h1>' + page.charAt(0).toUpperCase() + page.slice(1) + '</h1>' +
                      '<p>Content for ' + page + '</p>' +
                      '<a href="#" onclick="history.back()">Back</a>';
                    
                    // Update URL without page reload
                    history.pushState({ page }, page, '/' + page);
                    
                    // Track page view
                    this.track('page_view', {
                      properties: { page: page, path: '/' + page }
                    });
                  }
                });
              }
            }
            
            window.spa = new SPAAnalytics({
              endpoint: '${baseUrl}',
              writeKey: 'test-key',
            });
            
            window.spaReady = true;
          </script>
        </body>
        </html>
      `;

      await page.setContent(spaHtml);
      await page.waitForFunction(() => window.spaReady === true, { timeout: 5000 });
      
      // Navigate to page1
      await page.click('#page1-link');
      await page.waitForTimeout(100);
      
      // Navigate to page2
      await page.click('#page2-link');
      await page.waitForTimeout(100);
      
      // Check that multiple page views were tracked
      const pageViews = await page.evaluate(() => window.spa.pageViews.length);
      expect(pageViews).toBe(3); // home + page1 + page2
    });
  });

  describe("API Integration", () => {
    test("should accept events via API", async () => {
      const response = await page.evaluate(async (baseUrl) => {
        const result = await fetch(baseUrl + '/api/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key',
          },
          body: JSON.stringify({
            type: 'api_test',
            siteId: 'e2e-test',
            properties: {
              source: 'puppeteer',
              test_id: 'api-integration',
            }
          }),
        });
        
        return {
          status: result.status,
          data: await result.json(),
        };
      }, baseUrl);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe("ok");
      expect(response.data.processed).toBe(1);
    });

    test("should reject unauthorized API requests", async () => {
      const response = await page.evaluate(async (baseUrl) => {
        const result = await fetch(baseUrl + '/api/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Authorization header
          },
          body: JSON.stringify({
            type: 'unauthorized_test',
            siteId: 'e2e-test',
          }),
        });
        
        return {
          status: result.status,
        };
      }, baseUrl);

      expect(response.status).toBe(401);
    });

    test("should provide query API", async () => {
      // First, add some test data
      await fetch(`${baseUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({
          batch: [
            { type: "pageview", siteId: "query-test", sessionId: "session1" },
            { type: "click", siteId: "query-test", sessionId: "session1" },
          ],
        }),
      });

      // Query the data
      const response = await page.evaluate(async (baseUrl) => {
        const result = await fetch(baseUrl + '/api/v1/query', {
          headers: {
            'Authorization': 'Bearer test-key',
          },
        });
        
        return {
          status: result.status,
          data: await result.json(),
        };
      }, baseUrl);

      expect(response.status).toBe(200);
      expect(response.data.events).toBeDefined();
      expect(Array.isArray(response.data.events)).toBe(true);
    });

    test("should provide metrics API", async () => {
      const response = await page.evaluate(async (baseUrl) => {
        const result = await fetch(baseUrl + '/api/v1/metrics', {
          headers: {
            'Authorization': 'Bearer test-key',
          },
        });
        
        return {
          status: result.status,
          data: await result.json(),
        };
      }, baseUrl);

      expect(response.status).toBe(200);
      expect(response.data.metrics).toBeDefined();
      expect(typeof response.data.metrics.totalEvents).toBe("number");
    });
  });

  describe("Error Handling", () => {
    test("should handle malformed requests gracefully", async () => {
      const response = await page.evaluate(async (baseUrl) => {
        const result = await fetch(baseUrl + '/api/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key',
          },
          body: 'invalid json{',
        });
        
        return {
          status: result.status,
        };
      }, baseUrl);

      expect(response.status).toBe(500); // Server should handle parsing error gracefully
    });

    test("should handle network errors in browser client", async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            // Mock fetch to simulate network error
            const originalFetch = fetch;
            window.fetch = () => Promise.reject(new Error('Network error'));
            
            class ErrorTestAnalytics {
              async trackWithError() {
                try {
                  await fetch('/api/v1/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'test' }),
                  });
                  return { success: true };
                } catch (error) {
                  return { success: false, error: error.message };
                }
              }
            }
            
            window.errorTest = new ErrorTestAnalytics();
            window.errorTestReady = true;
          </script>
        </body>
        </html>
      `;

      await page.setContent(testHtml);
      await page.waitForFunction(() => window.errorTestReady === true);
      
      const result = await page.evaluate(() => window.errorTest.trackWithError());
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("Performance", () => {
    test("should handle multiple concurrent requests", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        fetch(`${baseUrl}/api/v1/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-key",
          },
          body: JSON.stringify({
            type: "concurrent_test",
            siteId: "performance-test",
            properties: { request_id: i },
          }),
        })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test("should respond quickly to health checks", async () => {
      const start = Date.now();
      const response = await fetch(`${baseUrl}/health`);
      const end = Date.now();
      
      expect(response.status).toBe(200);
      expect(end - start).toBeLessThan(100); // Should respond within 100ms
    });
  });
});