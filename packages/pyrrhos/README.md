# OpenAnalytics Development Package

A self-hosted, standards-based analytics platform built on modern web technologies.

## 🚀 Quick Start

```bash
# Install
bun add @pyrrhos/pyrrhos

# Basic server setup
import { openanalytics, MemoryStorage } from "@pyrrhos/pyrrhos";

const app = openanalytics({
  storage: MemoryStorage(),
  dashboard: { enabled: true }
});

// Start server (works with Bun, Node.js, Cloudflare Workers, etc.)
Bun.serve({ port: 3000, fetch: app.fetch });
```

## 📦 Package Structure

```
src/
├── index.ts           # Main entry point
├── collector.ts       # Event collection server
├── processor.ts       # Event processing utilities
├── storage/           # Storage adapters
│   ├── memory.ts      # In-memory storage
│   ├── d1.ts          # Cloudflare D1
│   ├── dynamodb.ts    # AWS DynamoDB
│   └── kv.ts          # Cloudflare KV
├── client/            # Client libraries
│   ├── browser.ts     # Browser client
│   └── index.ts       # Server client
└── ui/                # Dashboard components
    ├── dashboard.tsx  # Main dashboard
    ├── theme.ts       # Theming system
    └── index.tsx      # Server integration
```

## 🛠 Development

```bash
# Install dependencies
bun install

# Build package
bun run build

# Run tests
bun test

# Start development server
bun run examples/dev-server.ts
```

## 🧪 Testing

The package includes comprehensive tests for:
- ✅ Storage adapters (Memory, D1, DynamoDB, KV)
- ✅ Event collection and validation
- ✅ Dashboard functionality
- ✅ Rate limiting and privacy features
- ✅ Event processing pipelines

## 📊 Features Built

### Core Analytics Engine
- ✅ Universal event collection API
- ✅ Multiple storage backends
- ✅ Real-time event processing
- ✅ Privacy-compliant data handling
- ✅ Rate limiting and abuse prevention

### Storage Adapters
- ✅ **Memory** - Development and testing
- ✅ **D1** - Cloudflare's SQLite database
- ✅ **DynamoDB** - AWS NoSQL database  
- ✅ **KV** - Cloudflare Key-Value storage

### Dashboard & UI
- ✅ Real-time analytics dashboard
- ✅ Light/dark theme support
- ✅ Responsive design
- ✅ Authentication system
- ✅ Custom metrics and charts

### Client Libraries
- ✅ **Browser Client** - Auto-tracking, batching, privacy controls
- ✅ **Server Client** - Node.js/server-side tracking
- ✅ Privacy features (DNT, opt-out, IP anonymization)

### Deployment Support
- ✅ **Cloudflare Workers** - Edge deployment example
- ✅ **AWS Lambda** - Serverless deployment example
- ✅ **Bun/Node.js** - Traditional server deployment
- ✅ Docker and container support

### Event Processing
- ✅ Custom event processors
- ✅ Bot detection
- ✅ User agent parsing
- ✅ GeoIP integration (interface)
- ✅ Event validation and sanitization

## 🎯 Usage Examples

### Basic Analytics Server
```typescript
import { openanalytics, MemoryStorage } from "@pyrrhos/pyrrhos";

const app = openanalytics({
  storage: MemoryStorage({ maxEvents: 100000 }),
  writeKeys: ["your-api-key"],
  dashboard: {
    enabled: true,
    path: "/analytics",
    apiKey: "dashboard-key",
  },
});
```

### Browser Client
```html
<script type="module">
import { createClient } from "@pyrrhos/pyrrhos/client/browser";

const analytics = createClient({
  endpoint: "https://your-analytics.com",
  writeKey: "your-write-key",
  autoTrack: {
    pageViews: true,
    clicks: true,
    forms: true,
  },
});

// Track custom events
analytics.track("button_click", {
  properties: { button: "signup", page: "/landing" }
});
</script>
```

### Cloudflare Workers
```typescript
import { openanalytics, D1Storage } from "@pyrrhos/pyrrhos";

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

## 🏗 Architecture

OpenAnalytics follows a modular architecture:

1. **Collection Layer** - Handles incoming events via HTTP API
2. **Processing Layer** - Validates, enriches, and transforms events
3. **Storage Layer** - Pluggable storage backends for different environments
4. **Query Layer** - Provides analytics data via REST API
5. **Dashboard Layer** - Web-based analytics dashboard

## 📈 Performance

- **High Throughput** - Handles thousands of events per second
- **Low Latency** - Sub-millisecond event processing
- **Scalable** - Horizontal scaling with appropriate storage backend
- **Memory Efficient** - Minimal memory footprint
- **Edge Optimized** - Works great on Cloudflare Workers

## 🔐 Privacy & Compliance

- **GDPR Compliant** - Built-in privacy controls
- **Do Not Track** - Respects DNT headers
- **IP Anonymization** - Automatic IP address anonymization
- **Data Retention** - Configurable data retention policies
- **Opt-out Support** - User opt-out functionality

## 📚 Documentation

See the `examples/` directory for:
- Basic server setup
- Cloudflare Workers deployment
- AWS Lambda deployment
- Browser client integration
- Dashboard customization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run the test suite: `bun test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ using Bun, TypeScript, and Hono