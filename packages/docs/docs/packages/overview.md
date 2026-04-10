# Packages Overview

Nomo is a modular monorepo with packages for building serverless applications on Cloudflare Workers.

## Core Packages

| Package | Description |
|---------|-------------|
| `nomo/controllers` | Rails-like controllers for request handling |
| `nomo/router` | Request routing with trie-based matching |
| `nomo/services` | Service layer base classes |
| `nomo/models` | Database models with D1/DO support |
| `nomo/views` | JSX-based view rendering |
| `nomo/logger` | Structured logging with OpenTelemetry |

## Infrastructure Packages

| Package | Description |
|---------|-------------|
| `nomo/entrypoints` | HTTP entry point utilities |
| `nomo/durable-objects` | Durable Object helpers |
| `nomo/jobs` | Background job processing |
| `nomo/rpc` | RPC over HTTP |
| `nomo/sql` | SQL query builder |

## Utility Packages

| Package | Description |
|---------|-------------|
| `nomo/validators` | Input validation |
| `nomo/normalizers` | Data normalization |
| `nomo/formatters` | Output formatting |
| `nomo/assets` | Asset pipeline |
| `nomo/result` | Result/Either type |
| `nomo/shared` | Shared utilities |

## Installation

::: code-group

```bash [npm]
npm install nomo
```

```bash [pnpm]
pnpm add nomo
```

```bash [yarn]
yarn add nomo
```

```bash [bun]
bun add nomo
```

```bash [deno]
deno add nomo
```

:::

## Usage

::: code-group

```bash [npm]
# Install dependencies
npm install

# Build a specific package
cd packages/controllers && npm run build

# Run tests
npm test
```

```bash [pnpm]
# Install dependencies
pnpm install

# Build a specific package
cd packages/controllers && pnpm build

# Run tests
pnpm test
```

```bash [yarn]
# Install dependencies
yarn install

# Build a specific package
cd packages/controllers && yarn build

# Run tests
yarn test
```

```bash [bun]
# Install dependencies
bun install

# Build a specific package
cd packages/controllers && bun run build

# Run tests
bun test
```

```bash [deno]
# Install dependencies
deno install

# Build a specific package
cd packages/controllers && deno task build

# Run tests
deno task test
```

:::