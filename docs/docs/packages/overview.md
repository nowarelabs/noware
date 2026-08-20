# Packages Overview

Noware is a modular monorepo with packages for building serverless applications on Cloudflare Workers.

## Core Packages

| Package              | Description                                 |
| -------------------- | ------------------------------------------- |
| `noware/controllers` | Rails-like controllers for request handling |
| `noware/router`      | Request routing with trie-based matching    |
| `noware/services`    | Service layer base classes                  |
| `noware/models`      | Database models with D1/DO support          |
| `noware/views`       | JSX-based view rendering                    |
| `noware/logger`      | Structured logging with OpenTelemetry       |

## Infrastructure Packages

| Package                  | Description                |
| ------------------------ | -------------------------- |
| `noware/entrypoints`     | HTTP entry point utilities |
| `noware/durable-objects` | Durable Object helpers     |
| `noware/jobs`            | Background job processing  |
| `noware/rpc`             | RPC over HTTP              |
| `noware/sql`             | SQL query builder          |

## Utility Packages

| Package              | Description        |
| -------------------- | ------------------ |
| `noware/validators`  | Input validation   |
| `noware/normalizers` | Data normalization |
| `noware/formatters`  | Output formatting  |
| `noware/assets`      | Asset pipeline     |
| `noware/result`      | Result/Either type |
| `noware/shared`      | Shared utilities   |

## Installation

::: code-group

```bash [npm]
npm install noware
```

```bash [pnpm]
pnpm add noware
```

```bash [yarn]
yarn add noware
```

```bash [bun]
bun add noware
```

```bash [deno]
deno add noware
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
