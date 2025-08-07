# OpenAnalytics

A modular, self-hosted analytics platform built on modern web technologies.

## 🏗 Architecture

OpenAnalytics is designed as a modular system with focused, installable packages:

```
@pyrrhos/core              # Core analytics engine
@pyrrhos/client            # Browser & server clients  
@pyrrhos/storage-d1        # Cloudflare D1 storage
@pyrrhos/storage-kv        # Cloudflare KV storage
@pyrrhos/storage-dynamodb  # AWS DynamoDB storage
@pyrrhos/react             # React framework adapter
@pyrrhos/vue               # Vue 3 framework adapter
```

## 🚀 Quick Start

### Basic Server Setup

```bash
# Install core and storage
bun add @pyrrhos/core

# Basic setup (includes memory storage)
import { openanalytics, MemoryStorage } from "@pyrrhos/core";

const app = openanalytics({
  storage: MemoryStorage(),
  dashboard: { enabled: true }
});

Bun.serve({ port: 3000, fetch: app.fetch });
```

### With External Storage

```bash
# Install with Cloudflare D1
bun add @pyrrhos/core @pyrrhos/storage-d1

# Or AWS DynamoDB
bun add @pyrrhos/core @pyrrhos/storage-dynamodb
```

```typescript
import { openanalytics } from "@pyrrhos/core";
import { D1Storage } from "@pyrrhos/storage-d1";

const app = openanalytics({
  storage: D1Storage({ database: env.DB }),
  dashboard: { enabled: true }
});
```

### Browser Client

```bash
bun add @pyrrhos/client
```

```html
<script type="module">
import { createClient } from "@pyrrhos/client/browser";

const analytics = createClient({
  endpoint: "https://your-analytics.com",
  writeKey: "your-write-key",
  autoTrack: {
    pageViews: true,
    clicks: true,
  },
});

analytics.track("button_click", {
  properties: { button: "signup" }
});
</script>
```

### React Integration

```bash
bun add @pyrrhos/react @pyrrhos/client
```

```tsx
import { AnalyticsProvider, useTrackEvent } from "@pyrrhos/react";

function App() {
  return (
    <AnalyticsProvider options={{
      endpoint: "https://your-analytics.com",
      writeKey: "your-write-key"
    }}>
      <MyComponent />
    </AnalyticsProvider>
  );
}

function MyComponent() {
  const track = useTrackEvent();
  
  return (
    <button onClick={() => track("button_click")}>
      Click me
    </button>
  );
}
```

### Vue Integration

```bash
bun add @pyrrhos/vue @pyrrhos/client
```

```typescript
import { createApp } from 'vue';
import { AnalyticsPlugin } from '@pyrrhos/vue';

const app = createApp(App);

app.use(AnalyticsPlugin, {
  endpoint: 'https://your-analytics.com',
  writeKey: 'your-write-key'
});
```

```vue
<template>
  <button @click="trackClick" v-track="{ event: 'button_click' }">
    Click me
  </button>
</template>

<script setup>
import { useTrackEvent } from '@pyrrhos/vue';

const track = useTrackEvent();
const trackClick = () => track('button_click');
</script>
```

## 📦 Package Details

### Core Packages

- **`@pyrrhos/core`** - Main analytics engine with built-in memory storage
- **`@pyrrhos/client`** - Browser and server-side tracking clients

### Storage Adapters

Storage adapters are separate packages that can be installed as needed:

- **`@pyrrhos/storage-d1`** - Cloudflare D1 (SQLite) storage
- **`@pyrrhos/storage-kv`** - Cloudflare KV storage (high write volume)
- **`@pyrrhos/storage-dynamodb`** - AWS DynamoDB storage

### Framework Adapters

Framework-specific integrations for easier usage:

- **`@pyrrhos/react`** - React hooks, components, and providers
- **`@pyrrhos/vue`** - Vue 3 composables, directives, and plugins

## 🛠 Development

This is a monorepo managed with Bun workspaces:

```bash
# Install all dependencies
bun install

# Build all packages
bun run build

# Test all packages
bun run test

# Build specific package
bun run --filter="@pyrrhos/core" build
```

## 🚀 Deployment Examples

### Cloudflare Workers

```typescript
import { openanalytics } from "@pyrrhos/core";
import { D1Storage } from "@pyrrhos/storage-d1";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const analytics = openanalytics({
      storage: D1Storage({ database: env.ANALYTICS_DB }),
      writeKeys: [env.WRITE_KEY],
      dashboard: { enabled: true, apiKey: env.DASHBOARD_KEY },
    });
    
    return analytics.fetch(request);
  },
};
```

### AWS Lambda

```typescript
import { openanalytics } from "@pyrrhos/core";
import { DynamoDBStorage } from "@pyrrhos/storage-dynamodb";

const analytics = openanalytics({
  storage: DynamoDBStorage({
    tableName: process.env.DYNAMODB_TABLE!,
    region: process.env.AWS_REGION!,
  }),
  writeKeys: [process.env.WRITE_KEY!],
  dashboard: { enabled: true, apiKey: process.env.DASHBOARD_KEY },
});

export const handler = async (event: any) => {
  const request = new Request(/* convert API Gateway event */);
  const response = await analytics.fetch(request);
  return /* convert to API Gateway response */;
};
```

## 🎯 Benefits of Modular Architecture

1. **Smaller Bundle Sizes** - Only install what you need
2. **Platform Flexibility** - Mix and match storage backends
3. **Framework Integration** - Purpose-built adapters for React, Vue, etc.
4. **Independent Updates** - Storage adapters can be updated independently
5. **Custom Extensions** - Easy to create new storage adapters or framework integrations

## 📊 Features

- ✅ **Universal Event Collection** - Works across all JavaScript runtimes
- ✅ **Multiple Storage Backends** - Memory, D1, DynamoDB, KV
- ✅ **Real-time Dashboard** - Built-in analytics dashboard
- ✅ **Privacy Compliant** - GDPR compliance, DNT support, IP anonymization
- ✅ **Framework Integrations** - React and Vue adapters
- ✅ **High Performance** - Edge-optimized for Cloudflare Workers
- ✅ **Type Safe** - Full TypeScript support
- ✅ **Extensible** - Plugin architecture for custom processors

## 📚 Documentation

- [Core Package README](./packages/core/README.md)
- [Client Package README](./packages/client/README.md)
- [React Adapter README](./packages/adapters/react/README.md)
- [Vue Adapter README](./packages/adapters/vue/README.md)
- [Storage Adapters](./packages/storage-*/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in the appropriate package(s)
4. Add tests for new functionality
5. Run `bun run build && bun run test`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using Bun, TypeScript, and Hono**
