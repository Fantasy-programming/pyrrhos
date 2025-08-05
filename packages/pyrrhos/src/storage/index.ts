export interface Event {
  id?: string;
  type: string;
  timestamp: number;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  ip?: string;
  ua?: string;
  referrer?: string;
  url?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  [key: string]: any;
}

export interface QueryOptions {
  start?: number;
  end?: number;
  filter?: string;
  limit?: number;
}

export interface QueryResult {
  events?: Event[];
  metrics?: Record<string, number>;
  timeseries?: Array<{ timestamp: number, value: number }>;
}

export interface Storage {
  storeEvents(events: Event[]): Promise<void>;
  queryEvents(options: QueryOptions): Promise<QueryResult>;
}

// Export all storage adapters
export { MemoryStorage } from "./memory";
export { D1Storage } from "./d1";
export { DynamoDBStorage } from "./dynamodb";
export { KVStorage } from "./kv";
