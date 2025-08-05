/**
 * Cloudflare Workers deployment example
 * 
 * This shows how to deploy OpenAnalytics to Cloudflare Workers
 * using D1 database and KV storage for different use cases.
 */

import { openanalytics, D1Storage, KVStorage } from "../src";

// Environment variables interface for Cloudflare Workers
interface Env {
  ANALYTICS_DB: D1Database;
  ANALYTICS_KV: KVNamespace;
  WRITE_KEY: string;
  DASHBOARD_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use D1 for primary storage (better for queries)
    const analytics = openanalytics({
      storage: D1Storage({ database: env.ANALYTICS_DB }),
      
      // Production settings
      writeKeys: [env.WRITE_KEY],
      sample: 1, // 100% sampling for production
      
      // Enable dashboard
      dashboard: {
        enabled: true,
        path: "/dashboard",
        apiKey: env.DASHBOARD_KEY,
        title: "Production Analytics",
        theme: 'light',
      },
      
      // Privacy-compliant settings
      privacy: {
        anonymizeIPs: true,
        respectDNT: true,
      },
      
      // Rate limiting for abuse prevention
      rateLimits: {
        eventsPerMinute: 600,
        maxBatchSize: 50,
      },
    });
    
    return analytics.fetch(request);
  },
};

// Alternative KV-based setup for high write volume
export const kvBasedAnalytics = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const analytics = openanalytics({
      storage: KVStorage({ 
        namespace: env.ANALYTICS_KV,
        ttl: 60 * 60 * 24 * 90, // 90 days retention
      }),
      
      writeKeys: [env.WRITE_KEY],
      
      // Higher rate limits for KV (better write performance)
      rateLimits: {
        eventsPerMinute: 2000,
        maxBatchSize: 100,
      },
      
      dashboard: {
        enabled: true,
        path: "/dashboard",
        apiKey: env.DASHBOARD_KEY,
        title: "High Volume Analytics",
      },
    });
    
    return analytics.fetch(request);
  },
};