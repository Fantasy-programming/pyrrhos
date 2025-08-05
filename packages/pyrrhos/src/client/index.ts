export * from "./browser";

// Server-side client for Node.js environments
export interface ServerClientOptions {
  endpoint: string;
  writeKey: string;
  debug?: boolean;
}

export function createServerClient(options: ServerClientOptions) {
  const { endpoint, writeKey, debug = false } = options;

  return {
    async track(eventType: string, eventData: {
      userId?: string;
      sessionId?: string;
      anonymousId?: string;
      properties?: Record<string, any>;
      timestamp?: number;
      ip?: string;
      userAgent?: string;
    }): Promise<void> {
      const event = {
        id: crypto.randomUUID(),
        timestamp: eventData.timestamp || Date.now(),
        type: eventType,
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        anonymousId: eventData.anonymousId,
        properties: eventData.properties || {},
        ip: eventData.ip,
        ua: eventData.userAgent,
      };

      if (debug) console.log("[OpenAnalytics] Tracking server event:", event);

      const response = await fetch(`${endpoint}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${writeKey}`,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    },

    async batch(events: Array<{
      type: string;
      userId?: string;
      sessionId?: string;
      anonymousId?: string;
      properties?: Record<string, any>;
      timestamp?: number;
      ip?: string;
      userAgent?: string;
    }>): Promise<void> {
      const batch = events.map(event => ({
        id: crypto.randomUUID(),
        timestamp: event.timestamp || Date.now(),
        type: event.type,
        userId: event.userId,
        sessionId: event.sessionId,
        anonymousId: event.anonymousId,
        properties: event.properties || {},
        ip: event.ip,
        ua: event.userAgent,
      }));

      if (debug) console.log("[OpenAnalytics] Tracking server batch:", batch.length, "events");

      const response = await fetch(`${endpoint}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${writeKey}`,
        },
        body: JSON.stringify({ batch }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
  };
}