#!/usr/bin/env bun

/**
 * Test server for Docker integration tests
 */

import { openanalytics, MemoryStorage } from "./packages/core/dist/esm/index.js";

console.log("🐳 Starting Analytics Test Server in Docker...");

const analytics = openanalytics({
  storage: MemoryStorage({ maxEvents: 50000 }),
  
  // No authentication for testing
  writeKeys: [],
  
  // Allow all origins
  domains: ["*"],
  
  // Enable dashboard
  dashboard: {
    enabled: true,
    path: "/dashboard",
    title: "Docker Test Analytics",
    theme: 'light',
  },
  
  // Rate limiting for testing
  rateLimits: {
    eventsPerMinute: 10000,
    maxBatchSize: 1000,
  },
  
  // Privacy settings
  privacy: {
    anonymizeIPs: false, // Disabled for testing
    respectDNT: false,   // Disabled for testing
  },
});

const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch: analytics.fetch,
});

console.log(`✅ Test server running on http://localhost:${server.port}`);
console.log(`📊 Dashboard: http://localhost:${server.port}/dashboard`);
console.log(`🔍 Health: http://localhost:${server.port}/health`);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📥 Received SIGTERM, shutting down gracefully');
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📥 Received SIGINT, shutting down gracefully');
  server.stop();
  process.exit(0);
});