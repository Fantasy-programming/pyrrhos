/**
 * @pyrrhos/react - React adapter for OpenAnalytics
 */

import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { createClient, AnalyticsClient, ClientOptions } from '@pyrrhos/client';

// Context for the analytics client
const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export interface AnalyticsProviderProps {
  children: ReactNode;
  options: ClientOptions;
}

export function AnalyticsProvider({ children, options }: AnalyticsProviderProps) {
  const clientRef = useRef<AnalyticsClient | null>(null);

  // Initialize client only once
  if (!clientRef.current) {
    clientRef.current = createClient(options);
  }

  return (
    <AnalyticsContext.Provider value={clientRef.current}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsClient {
  const client = useContext(AnalyticsContext);
  if (!client) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return client;
}

export interface TrackEventOptions {
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export function useTrackEvent() {
  const analytics = useAnalytics();

  return (eventType: string, options?: TrackEventOptions) => {
    analytics.track(eventType, options);
  };
}

export function usePageView() {
  const analytics = useAnalytics();

  return (properties?: Record<string, any>) => {
    analytics.page(properties);
  };
}

export function useIdentify() {
  const analytics = useAnalytics();

  return (userId: string, traits?: Record<string, any>) => {
    analytics.identify(userId, traits);
  };
}

// Component to track page views automatically
export interface PageViewTrackerProps {
  path?: string;
  title?: string;
  properties?: Record<string, any>;
}

export function PageViewTracker({ path, title, properties }: PageViewTrackerProps) {
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.page({
      path: path || window.location.pathname,
      title: title || document.title,
      ...properties,
    });
  }, [path, title, properties, analytics]);

  return null;
}

// Hook to track page views automatically on route changes
export function useAutoPageView(enabled: boolean = true) {
  const analytics = useAnalytics();

  useEffect(() => {
    if (!enabled) return;

    // Track initial page view
    analytics.page({
      path: window.location.pathname,
      title: document.title,
    });

    // Listen for route changes (for SPAs)
    const handleRouteChange = () => {
      analytics.page({
        path: window.location.pathname,
        title: document.title,
      });
    };

    // Listen to both popstate and pushstate/replacestate
    window.addEventListener('popstate', handleRouteChange);

    // Override history methods to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [analytics, enabled]);
}

// Component for tracking clicks
export interface ClickTrackerProps {
  children: ReactNode;
  eventName?: string;
  properties?: Record<string, any>;
  onClick?: (event: React.MouseEvent) => void;
}

export function ClickTracker({
  children,
  eventName = 'click',
  properties = {},
  onClick
}: ClickTrackerProps) {
  const track = useTrackEvent();

  const handleClick = (event: React.MouseEvent) => {
    track(eventName, { properties });
    onClick?.(event);
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}
