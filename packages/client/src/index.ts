/**
 * @pyrrhos/client - Analytics client library
 * 
 * Provides both browser and server-side clients for tracking events
 * to OpenAnalytics servers.
 */

export * from "./browser.js";
export * from "./server.js";

// Re-export the main client creators for convenience
export { createClient } from "./browser.js";
export { createServerClient } from "./server.js";