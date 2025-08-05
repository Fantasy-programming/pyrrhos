import type { Storage, Event, QueryOptions, QueryResult } from "./index";

export interface D1StorageOptions {
  database: D1Database;
}

export function D1Storage(options: D1StorageOptions): Storage {
  const { database } = options;

  // Initialize schema if needed
  const initSchema = async () => {
    await database.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        site_id TEXT,
        user_id TEXT,
        session_id TEXT,
        properties TEXT,
        ip TEXT,
        ua TEXT,
        referrer TEXT,
        url TEXT,
        language TEXT,
        screen_width INTEGER,
        screen_height INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_site_id ON events(site_id);
    `);
  };

  return {
    async storeEvents(events: Event[]): Promise<void> {
      await initSchema();

      const stmt = database.prepare(`
        INSERT INTO events (
          id, timestamp, type, site_id, user_id, session_id, 
          properties, ip, ua, referrer, url, language, 
          screen_width, screen_height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = events.map(event => 
        stmt.bind(
          event.id || crypto.randomUUID(),
          event.timestamp,
          event.type,
          event.siteId,
          event.userId || null,
          event.sessionId || null,
          JSON.stringify(event.properties || {}),
          event.ip || null,
          event.ua || null,
          event.referrer || null,
          event.url || null,
          event.language || null,
          event.screenWidth || null,
          event.screenHeight || null
        )
      );

      await database.batch(batch);
    },

    async queryEvents(options: QueryOptions): Promise<QueryResult> {
      const { start, end = Date.now(), filter, limit = 1000 } = options;
      const startTime = start || 0;

      let query = `
        SELECT * FROM events 
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      const { results } = await database.prepare(query)
        .bind(startTime, end, limit)
        .all();

      const events = results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        type: row.type,
        siteId: row.site_id,
        userId: row.user_id,
        sessionId: row.session_id,
        properties: JSON.parse(row.properties || '{}'),
        ip: row.ip,
        ua: row.ua,
        referrer: row.referrer,
        url: row.url,
        language: row.language,
        screenWidth: row.screen_width,
        screenHeight: row.screen_height,
      })) as Event[];

      // Apply additional filtering if provided
      let filteredEvents = events;
      if (filter) {
        try {
          const filterFn = new Function('event', `return ${filter}`);
          filteredEvents = events.filter(filterFn);
        } catch (e) {
          console.error("Invalid filter expression:", e);
        }
      }

      // Calculate metrics
      const uniqueUsers = new Set(filteredEvents.map(e => e.userId || e.ip)).size;
      const pageViews = filteredEvents.filter(e => e.type === 'pageview').length;

      return {
        events: filteredEvents,
        metrics: {
          totalEvents: filteredEvents.length,
          uniqueUsers,
          pageViews,
        },
      };
    }
  };
}