export interface ClientOptions {
  endpoint: string;
  writeKey?: string;
  siteId?: string;
  debug?: boolean;
  sample?: number;
  autoTrack?: {
    pageViews?: boolean;
    clicks?: boolean;
    forms?: boolean;
    scrollDepth?: boolean;
  };
  privacy?: {
    anonymizeIP?: boolean;
    respectDNT?: boolean;
    cookieless?: boolean;
  };
  batchSize?: number;
  flushInterval?: number; // in milliseconds
}

export interface TrackOptions {
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export interface AnalyticsClient {
  track(eventType: string, options?: TrackOptions): void;
  page(properties?: Record<string, any>): void;
  identify(userId: string, traits?: Record<string, any>): void;
  reset(): void;
  getSessionId(): string;
  getAnonymousId(): string;
  optOut(): void;
  optIn(): void;
  isOptedOut(): boolean;
  flush(): Promise<void>;
}

export function createClient(options: ClientOptions): AnalyticsClient {
  const {
    endpoint,
    writeKey,
    siteId,
    debug = false,
    sample = 1,
    autoTrack = {
      pageViews: true,
      clicks: false,
      forms: false,
      scrollDepth: false,
    },
    privacy = {
      anonymizeIP: true,
      respectDNT: true,
      cookieless: false,
    },
    batchSize = 20,
    flushInterval = 5000,
  } = options;

  // Check Do Not Track
  if (privacy.respectDNT && (navigator.doNotTrack === "1" || (navigator as any).msDoNotTrack === "1")) {
    if (debug) console.log("[OpenAnalytics] Do Not Track enabled, analytics disabled");
    return createNoOpClient();
  }

  // Apply sampling at client level
  if (sample < 1 && Math.random() > sample) {
    if (debug) console.log("[OpenAnalytics] Sampled out");
    return createNoOpClient();
  }

  // Storage keys
  const STORAGE_PREFIX = privacy.cookieless ? 'oa_' : 'oa_';
  const SESSION_KEY = `${STORAGE_PREFIX}session`;
  const USER_KEY = `${STORAGE_PREFIX}user`;
  const OPTED_OUT_KEY = `${STORAGE_PREFIX}opted_out`;

  // Event queue
  let eventQueue: any[] = [];
  let flushTimer: number | null = null;

  // Session management
  let sessionId = getOrCreateSessionId();
  let anonymousId = getOrCreateAnonymousId();
  let userId: string | undefined;

  function getStorageItem(key: string): string | null {
    try {
      if (privacy.cookieless) {
        return localStorage.getItem(key);
      } else {
        // Cookie implementation
        const name = key + "=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
          let c = ca[i];
          while (c.charAt(0) === ' ') {
            c = c.substring(1);
          }
          if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
          }
        }
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  function setStorageItem(key: string, value: string, days: number = 365): void {
    try {
      if (privacy.cookieless) {
        localStorage.setItem(key, value);
      } else {
        // Cookie implementation
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${key}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
      }
    } catch (e) {
      // Storage failed, continue without persistence
    }
  }

  function getOrCreateSessionId(): string {
    let stored = getStorageItem(SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        // Check if session is still valid (30 minutes)
        if (Date.now() - session.lastActivity < 30 * 60 * 1000) {
          return session.id;
        }
      } catch (e) {
        // Invalid session data
      }
    }
    
    // Create new session
    const newSessionId = generateId();
    const sessionData = {
      id: newSessionId,
      lastActivity: Date.now(),
    };
    setStorageItem(SESSION_KEY, JSON.stringify(sessionData));
    return newSessionId;
  }

  function getOrCreateAnonymousId(): string {
    let stored = getStorageItem(USER_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        return user.anonymousId;
      } catch (e) {
        // Invalid user data
      }
    }
    
    // Create new anonymous ID
    const newAnonymousId = generateId();
    const userData = {
      anonymousId: newAnonymousId,
    };
    setStorageItem(USER_KEY, JSON.stringify(userData));
    return newAnonymousId;
  }

  function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function updateSessionActivity(): void {
    const sessionData = {
      id: sessionId,
      lastActivity: Date.now(),
    };
    setStorageItem(SESSION_KEY, JSON.stringify(sessionData));
  }

  function createEvent(type: string, options: TrackOptions = {}): any {
    updateSessionActivity();

    return {
      id: generateId(),
      timestamp: options.timestamp || Date.now(),
      type,
      siteId,
      userId: options.userId || userId,
      sessionId: options.sessionId || sessionId,
      anonymousId,
      properties: options.properties || {},
      context: {
        url: window.location.href,
        referrer: document.referrer,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        userAgent: navigator.userAgent,
        library: {
          name: "@pyrrhos/pyrrhos",
          version: "0.0.0", // TODO: Get from package.json
        },
      },
    };
  }

  function queueEvent(event: any): void {
    if (isOptedOut()) {
      if (debug) console.log("[OpenAnalytics] User opted out, ignoring event");
      return;
    }

    eventQueue.push(event);
    
    if (debug) console.log("[OpenAnalytics] Event queued:", event);

    // Flush if batch is full
    if (eventQueue.length >= batchSize) {
      flush();
    } else if (!flushTimer) {
      // Set flush timer
      flushTimer = window.setTimeout(() => {
        flush();
      }, flushInterval);
    }
  }

  async function flush(): Promise<void> {
    if (eventQueue.length === 0) return;

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    const events = [...eventQueue];
    eventQueue = [];

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (writeKey) {
        headers["Authorization"] = `Bearer ${writeKey}`;
      }

      const response = await fetch(`${endpoint}/api/v1/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({ batch: events }),
        keepalive: true,
      });

      if (!response.ok) {
        // Re-queue events on failure
        eventQueue.unshift(...events);
        throw new Error(`HTTP ${response.status}`);
      }

      if (debug) console.log("[OpenAnalytics] Events sent successfully:", events.length);

    } catch (error) {
      if (debug) console.error("[OpenAnalytics] Error sending events:", error);
      // Re-queue events for retry
      eventQueue.unshift(...events);
    }
  }

  // Set up auto-tracking
  if (autoTrack.pageViews) {
    // Track initial page view
    queueEvent(createEvent("page_view", {
      properties: {
        title: document.title,
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      },
    }));

    // Track page changes for SPAs
    let currentPath = window.location.pathname;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        queueEvent(createEvent("page_view", {
          properties: {
            title: document.title,
            path: currentPath,
            search: window.location.search,
            hash: window.location.hash,
          },
        }));
      }
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        queueEvent(createEvent("page_view", {
          properties: {
            title: document.title,
            path: currentPath,
            search: window.location.search,
            hash: window.location.hash,
          },
        }));
      }
    };

    window.addEventListener("popstate", () => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        queueEvent(createEvent("page_view", {
          properties: {
            title: document.title,
            path: currentPath,
            search: window.location.search,
            hash: window.location.hash,
          },
        }));
      }
    });
  }

  if (autoTrack.clicks) {
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      queueEvent(createEvent("click", {
        properties: {
          elementId: target.id,
          elementClass: target.className,
          elementTag: target.tagName,
          elementText: target.textContent?.slice(0, 100),
          position: {
            x: event.clientX,
            y: event.clientY,
          },
        },
      }));
    });
  }

  if (autoTrack.forms) {
    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      const formData = new FormData(form);
      const fields = Array.from(formData.keys());
      
      queueEvent(createEvent("form_submit", {
        properties: {
          formId: form.id,
          formName: form.name,
          formAction: form.action,
          fields,
        },
      }));
    });
  }

  if (autoTrack.scrollDepth) {
    let maxScrollDepth = 0;
    let scrollTimer: number | null = null;

    window.addEventListener("scroll", () => {
      if (scrollTimer) return;
      
      scrollTimer = window.setTimeout(() => {
        const scrollDepth = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollDepth > maxScrollDepth) {
          maxScrollDepth = scrollDepth;
          
          // Track at 25%, 50%, 75%, and 100% thresholds
          const thresholds = [25, 50, 75, 100];
          const threshold = thresholds.find(t => maxScrollDepth >= t && maxScrollDepth < t + 5);
          
          if (threshold) {
            queueEvent(createEvent("scroll_depth", {
              properties: {
                depth: threshold,
                maxDepth: maxScrollDepth,
              },
            }));
          }
        }
        
        scrollTimer = null;
      }, 100);
    });
  }

  // Flush events before page unload
  window.addEventListener("beforeunload", () => {
    if (eventQueue.length > 0) {
      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        const headers = writeKey ? { "Authorization": `Bearer ${writeKey}` } : {};
        const blob = new Blob([JSON.stringify({ batch: eventQueue })], {
          type: "application/json",
        });
        navigator.sendBeacon(`${endpoint}/api/v1/events`, blob);
      }
    }
  });

  function isOptedOut(): boolean {
    return getStorageItem(OPTED_OUT_KEY) === "true";
  }

  // Public API
  return {
    track(eventType: string, options: TrackOptions = {}): void {
      queueEvent(createEvent(eventType, options));
    },

    page(properties: Record<string, any> = {}): void {
      queueEvent(createEvent("page_view", {
        properties: {
          title: document.title,
          path: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          ...properties,
        },
      }));
    },

    identify(newUserId: string, traits: Record<string, any> = {}): void {
      userId = newUserId;
      
      // Update stored user data
      const userData = {
        anonymousId,
        userId: newUserId,
        traits,
      };
      setStorageItem(USER_KEY, JSON.stringify(userData));

      queueEvent(createEvent("identify", {
        userId: newUserId,
        properties: traits,
      }));
    },

    reset(): void {
      sessionId = generateId();
      anonymousId = generateId();
      userId = undefined;
      
      // Clear storage
      try {
        if (privacy.cookieless) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(USER_KEY);
        } else {
          document.cookie = `${SESSION_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${USER_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      } catch (e) {
        // Storage operation failed
      }
    },

    getSessionId(): string {
      return sessionId;
    },

    getAnonymousId(): string {
      return anonymousId;
    },

    optOut(): void {
      setStorageItem(OPTED_OUT_KEY, "true");
      eventQueue = []; // Clear pending events
    },

    optIn(): void {
      try {
        if (privacy.cookieless) {
          localStorage.removeItem(OPTED_OUT_KEY);
        } else {
          document.cookie = `${OPTED_OUT_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      } catch (e) {
        // Storage operation failed
      }
    },

    isOptedOut(): boolean {
      return isOptedOut();
    },

    flush(): Promise<void> {
      return flush();
    },
  };
}

function createNoOpClient(): AnalyticsClient {
  return {
    track: () => {},
    page: () => {},
    identify: () => {},
    reset: () => {},
    getSessionId: () => "",
    getAnonymousId: () => "",
    optOut: () => {},
    optIn: () => {},
    isOptedOut: () => true,
    flush: async () => {},
  };
}
