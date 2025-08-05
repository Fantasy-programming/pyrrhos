/**
 * @pyrrhos/core - Core analytics engine
 * 
 * This package provides the fundamental analytics collection and processing
 * capabilities. Storage adapters are provided by separate packages.
 */

import { collector } from "./collector.js";
import { createDashboard } from "./ui/index.js";
import type { Storage, Event } from "./types.js";

export interface OpenAnalyticsOptions {
  storage: Storage;
  domains?: string[];
  sample?: number;
  writeKeys?: string[];
  rateLimits?: {
    eventsPerMinute?: number;
    maxBatchSize?: number;
  };
  privacy?: {
    anonymizeIPs?: boolean;
    respectDNT?: boolean;
  };
  dashboard?: {
    enabled: boolean;
    path?: string;
    apiKey?: string;
    title?: string;
    theme?: 'light' | 'dark';
  };
  processEvents?: (events: Event[]) => Promise<Event[]>;
}

export function openanalytics(options: OpenAnalyticsOptions) {
  const app = collector({
    storage: options.storage,
    domains: options.domains,
    sample: options.sample,
    writeKeys: options.writeKeys,
    rateLimits: options.rateLimits,
    privacy: options.privacy,
    processEvents: options.processEvents,
  });

  // Add dashboard if enabled
  if (options.dashboard?.enabled) {
    const path = options.dashboard.path || "/dashboard";
    const dashboard = createDashboard({
      storage: options.storage,
      apiKey: options.dashboard.apiKey,
      title: options.dashboard.title,
      theme: options.dashboard.theme,
    });

    app.route(path, dashboard);
  }

  return app;
}

// Re-export core types and utilities
export * from "./types.js";
export * from "./collector.js";
export * from "./processor.js";
export * from "./ui/index.js";

// Default export for convenience
export default openanalytics;