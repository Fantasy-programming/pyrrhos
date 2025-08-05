#!/usr/bin/env bun

/**
 * Simple development server for testing OpenAnalytics
 * 
 * Run with: bun run examples/dev-server.ts
 */

import { openanalytics, MemoryStorage } from "../src";

const analytics = openanalytics({
  storage: MemoryStorage({ maxEvents: 10000 }),
  
  // Allow all origins for development
  domains: ["*"],
  
  // No authentication required for dev
  writeKeys: [],
  
  // Enable dashboard
  dashboard: {
    enabled: true,
    path: "/dashboard",
    title: "Development Dashboard",
    theme: 'light',
  },
  
  // Add some custom event processing
  processEvents: async (events) => {
    console.log(`📊 Processing ${events.length} events`);
    return events.map(event => ({
      ...event,
      properties: {
        ...event.properties,
        environment: 'development',
        processed_at: new Date().toISOString(),
      },
    }));
  },
});

const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch: analytics.fetch,
});

console.log(`
🚀 OpenAnalytics Development Server Started!

📍 Server:    http://localhost:${server.port}
📊 Dashboard: http://localhost:${server.port}/dashboard
🔍 Health:    http://localhost:${server.port}/health

📡 API Endpoints:
  POST /api/v1/events  - Track events
  GET  /api/v1/query   - Query events
  GET  /api/v1/metrics - Get metrics

💡 Try sending an event:
curl -X POST http://localhost:${server.port}/api/v1/events \\
  -H "Content-Type: application/json" \\
  -d '{"type": "pageview", "siteId": "test", "properties": {"path": "/"}}'
`);

// Add some sample data for testing
setTimeout(async () => {
  console.log("📝 Adding sample data...");
  
  const sampleEvents = [
    {
      type: "pageview",
      siteId: "demo",
      sessionId: "session_1",
      timestamp: Date.now() - 3600000, // 1 hour ago
      properties: { path: "/", title: "Home Page" },
    },
    {
      type: "pageview",
      siteId: "demo", 
      sessionId: "session_2",
      timestamp: Date.now() - 1800000, // 30 minutes ago
      properties: { path: "/about", title: "About Page" },
    },
    {
      type: "click",
      siteId: "demo",
      sessionId: "session_1", 
      timestamp: Date.now() - 900000, // 15 minutes ago
      properties: { element: "button", text: "Sign Up" },
    },
    {
      type: "custom_event",
      siteId: "demo",
      sessionId: "session_2",
      timestamp: Date.now() - 300000, // 5 minutes ago
      properties: { action: "newsletter_signup", email: "test@example.com" },
    },
  ];

  const response = await fetch(`http://localhost:${server.port}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch: sampleEvents }),
  });

  if (response.ok) {
    console.log("✅ Sample data added successfully");
  } else {
    console.log("❌ Failed to add sample data");
  }
}, 1000);