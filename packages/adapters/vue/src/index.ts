/**
 * @pyrrhos/vue - Vue 3 adapter for OpenAnalytics
 */

import { App, inject, InjectionKey, Plugin } from 'vue';
import { createClient, AnalyticsClient, ClientOptions } from '@pyrrhos/client';

// Injection key for the analytics client
const analyticsKey: InjectionKey<AnalyticsClient> = Symbol('analytics');

export interface AnalyticsPluginOptions extends ClientOptions {}

// Vue plugin
export const AnalyticsPlugin: Plugin = {
  install(app: App, options: AnalyticsPluginOptions) {
    const client = createClient(options);
    app.provide(analyticsKey, client);
    
    // Add global properties
    app.config.globalProperties.$analytics = client;
  }
};

// Composable to use analytics
export function useAnalytics(): AnalyticsClient {
  const client = inject(analyticsKey);
  if (!client) {
    throw new Error('useAnalytics must be used after installing AnalyticsPlugin');
  }
  return client;
}

export function useTrackEvent() {
  const analytics = useAnalytics();
  
  return (eventType: string, options?: {
    userId?: string;
    sessionId?: string;
    properties?: Record<string, any>;
    timestamp?: number;
  }) => {
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

// Directive for tracking clicks
export const vTrack = {
  mounted(el: HTMLElement, binding: any) {
    const { value } = binding;
    const eventName = value?.event || 'click';
    const properties = value?.properties || {};
    
    const analytics = inject(analyticsKey);
    if (!analytics) return;

    const handleClick = () => {
      analytics.track(eventName, { properties });
    };

    el.addEventListener('click', handleClick);
    (el as any)._vTrackHandler = handleClick;
  },
  
  unmounted(el: HTMLElement) {
    const handler = (el as any)._vTrackHandler;
    if (handler) {
      el.removeEventListener('click', handler);
      delete (el as any)._vTrackHandler;
    }
  }
};

// Auto page tracking for Vue Router
export function createAutoPageTracker(router: any) {
  const analytics = inject(analyticsKey);
  if (!analytics) return;

  router.afterEach((to: any) => {
    analytics.page({
      path: to.fullPath,
      name: to.name,
      title: document.title,
    });
  });
}

// Export everything
export default AnalyticsPlugin;