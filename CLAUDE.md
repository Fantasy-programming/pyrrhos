# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenAnalytics is a self-hosted, standards-based analytics platform following the OpenAuth architectural pattern. It provides universal analytics capabilities deployable as a standalone service or embedded into existing applications. The system runs entirely on user infrastructure and supports deployment on Node.js, Bun, AWS Lambda, Cloudflare Workers, and containerized environments.

## Architecture

This is a monorepo structure with the following key components:

- **Root package.json**: Workspace configuration with release scripts
- **packages/pyrrhos/**: Core analytics engine package
  - `src/`: Main source code
    - `collector.ts`: Event collection and processing
    - `storage/`: Storage adapters (D1, DynamoDB, KV, Memory)
    - `client/browser.ts`: Browser client library
    - `ui/`: Dashboard components (React/TSX)
  - `script/build.ts`: Build configuration

The project is built using:
- **TypeScript**: Strict configuration with ESNext target
- **Hono**: Web framework for universal compatibility
- **Valibot**: Schema validation
- **Bun**: Primary runtime and package manager

## Common Commands

### Development
```bash
# Install dependencies
bun install

# Build the core package
cd packages/pyrrhos && bun run build

# Run tests
cd packages/pyrrhos && bun test

# Release (builds and publishes)
bun run release
```

### Package Structure
The project uses Bun workspaces with exact version pinning (`bunfig.toml`). The main package exports are configured for both ESM and TypeScript definitions.

## Key Technical Details

### Storage Adapters
The system supports multiple storage backends through a pluggable adapter interface:
- **D1**: Cloudflare's SQLite-based database
- **DynamoDB**: AWS NoSQL database
- **KV**: Key-value storage (Cloudflare KV)
- **Memory**: In-memory storage for development/testing

### Event System
Based on comprehensive event schemas supporting:
- Page events (views, leaves)
- User interactions (clicks, forms)
- E-commerce events (purchases, cart actions)
- Custom events

### Deployment Targets
Universal deployment support for:
- AWS Lambda
- Cloudflare Workers
- Node.js servers
- Bun runtime
- Docker containers

## Configuration

The system uses environment variables and configuration objects for deployment-specific settings including storage adapters, authentication keys, privacy controls, and rate limiting.

TypeScript configuration uses strict mode with bundler module resolution, targeting ESNext for modern JavaScript features while maintaining broad compatibility.