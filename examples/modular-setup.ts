/**
 * Example: Modular OpenAnalytics Setup
 * 
 * This example shows how to use the new modular architecture
 * with separate packages for different storage backends.
 */

// Core analytics engine (always required)
import { openanalytics, MemoryStorage } from "@pyrrhos/core";

// Storage adapters (install only what you need)
// import { D1Storage } from "@pyrrhos/storage-d1";
// import { KVStorage } from "@pyrrhos/storage-kv";
// import { DynamoDBStorage } from "@pyrrhos/storage-dynamodb";

// Framework adapters (optional)
// import { AnalyticsProvider } from "@pyrrhos/react";
// import { AnalyticsPlugin } from "@pyrrhos/vue";

// Example 1: Basic setup with memory storage (development)
const basicAnalytics = openanalytics({
  storage: MemoryStorage({ maxEvents: 10000 }),
  dashboard: { enabled: true },
});

// Example 2: Production setup with D1 storage (commented out)
/*
const productionAnalytics = openanalytics({
  storage: D1Storage({ database: env.ANALYTICS_DB }),
  writeKeys: [env.WRITE_KEY],
  dashboard: {
    enabled: true,
    apiKey: env.DASHBOARD_KEY,
    title: "Production Analytics",
  },
  privacy: {
    anonymizeIPs: true,
    respectDNT: true,
  },
});
*/

// Example 3: High-volume setup with KV storage (commented out)
/*
const highVolumeAnalytics = openanalytics({
  storage: KVStorage({ 
    namespace: env.ANALYTICS_KV,
    ttl: 60 * 60 * 24 * 90, // 90 days
  }),
  rateLimits: {
    eventsPerMinute: 2000,
    maxBatchSize: 100,
  },
  dashboard: { enabled: true },
});
*/

// Start server
const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch: basicAnalytics.fetch,
});

console.log(`
🚀 OpenAnalytics Modular Example

📍 Server:    http://localhost:${server.port}
📊 Dashboard: http://localhost:${server.port}/dashboard

🏗  Architecture Benefits:
✅ Smaller bundles - only install needed storage adapters
✅ Mix & match - combine different storage backends
✅ Framework ready - React/Vue adapters available separately
✅ Independent updates - update storage adapters independently

📦 Available Packages:
   @pyrrhos/core              - Core engine (installed)
   @pyrrhos/client            - Browser/server clients
   @pyrrhos/storage-d1        - Cloudflare D1 storage
   @pyrrhos/storage-kv        - Cloudflare KV storage  
   @pyrrhos/storage-dynamodb  - AWS DynamoDB storage
   @pyrrhos/react             - React framework adapter
   @pyrrhos/vue               - Vue 3 framework adapter

💡 Install only what you need:
   bun add @pyrrhos/core @pyrrhos/storage-d1
`);