import { collector } from "./collector";
import { createDashboard } from "./ui";
import { Storage } from "./storage";

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

// Re-export everything
export * from "./storage";
export * from "./client";
export * from "./ui";
export * from "./collector";
export * from "./processor";

// Default export for convenience
export default openanalytics;
