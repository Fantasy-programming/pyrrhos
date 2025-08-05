/**
 * Basic OpenAnalytics setup example
 * 
 * This shows how to set up OpenAnalytics with memory storage
 * for development and testing.
 */

import { openanalytics, MemoryStorage } from "../src";

// Create analytics instance with memory storage
const analytics = openanalytics({
  storage: MemoryStorage({ maxEvents: 10000 }),
  
  // Optional: Enable CORS for specific domains
  domains: ["http://localhost:3000", "https://mysite.com"],
  
  // Optional: Sampling rate (0-1, where 1 = 100%)
  sample: 1,
  
  // Optional: API keys for authentication
  writeKeys: ["your-write-key-here"],
  
  // Optional: Rate limiting
  rateLimits: {
    eventsPerMinute: 1000,
    maxBatchSize: 100,
  },
  
  // Optional: Privacy settings
  privacy: {
    anonymizeIPs: true,
    respectDNT: true,
  },
  
  // Optional: Enable dashboard
  dashboard: {
    enabled: true,
    path: "/dashboard",
    apiKey: "your-dashboard-key",
    title: "My Analytics Dashboard",
    theme: 'light',
  },
});

// Export for use in your web framework
export default analytics;

// Example usage with Bun
if (import.meta.main) {
  const server = Bun.serve({
    port: 3000,
    fetch: analytics.fetch,
  });
  
  console.log(`OpenAnalytics running on http://localhost:${server.port}`);
  console.log(`Dashboard: http://localhost:${server.port}/dashboard?key=your-dashboard-key`);
}