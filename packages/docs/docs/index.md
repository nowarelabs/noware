# Nomo Framework

A modular framework for building serverless applications on Cloudflare Workers.

## Features

- **Controllers** - Rails-like MVC pattern
- **Router** - Trie-based routing with OpenAPI support
- **Models** - Database models with D1/DO support
- **Services** - Service layer for business logic
- **Logger** - Structured logging with OpenTelemetry
- **Durable Objects** - Stateful coordination
- **Jobs** - Background job processing

## Quick Start

```bash
# Clone the repo
git clone https://github.com/vanceworks/nomo.git
cd nomo

# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Packages

Explore the [Packages Overview](/packages/overview) to learn about all available packages.

## Architecture

Nomo follows a layered architecture:
- **Entrypoints** - HTTP request handling
- **Controllers** - Request/response logic
- **Services** - Business logic
- **Models** - Data access layer

[Learn more about the architecture →](/packages/architecture)