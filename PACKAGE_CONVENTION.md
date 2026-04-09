# Package Convention

This document outlines the conventions and requirements for all packages in the nomo monorepo.

## Required package.json Fields

All packages must include the following fields:

```json
{
  "name": "nomo/<package-name>",
  "version": "1.0.0",
  "description": "Description of what this package provides",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "...",
    "dev": "...",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src",
    "format": "prettier --write src"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.x.x",
    "typescript": "^5.x.x"
  }
}
```

## tsconfig.json Requirements

Each package must have a `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["@cloudflare/workers-types"],
    "lib": ["es2024", "dom", "dom.iterable"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "node_modules", "dist"]
}
```

## Required Scripts

Each package must implement these scripts:

| Script      | Purpose                               |
| ----------- | ------------------------------------- |
| `build`     | Compile the package (tsup, tsc, etc.) |
| `dev`       | Watch mode for development            |
| `typecheck` | Type-check without emitting           |
| `test`      | Run tests (vitest run)                |
| `lint`      | Lint the source (eslint src)          |
| `format`    | Format source (prettier --write src)  |

## Export Structure

All packages must export their public API from `src/index.ts`:

```typescript
// src/index.ts
export { Router } from "./router";
export type { RouterOptions, RouteConfig } from "./types";
```

## Directory Structure

```
packages/<package>/
├── src/
│   ├── index.ts        # Main entry point
│   ├── *.ts           # Implementation files
│   └── *.test.ts      # Test files
├── dist/               # Build output (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts     # Optional (if using tsup)
└── vitest.config.ts   # Optional (if package has tests)
```

## Dependencies

- Internal packages must use `workspace:*` protocol
- Cloudflare Workers types should be in devDependencies
- Avoid external dependencies when possible

## Testing

- Use Vitest for all tests
- Test files should be co-located with source (`*.test.ts`)
- Aim for 70% code coverage minimum
