---
description: Reference for scaffolding a new Flue project, interactively or with flags.
title: flue init | Flue
image: https://flueframework.com/docs/og4.jpg
---

# flue init

Last updated Jul 21, 2026[View as Markdown](https://flueframework.com/docs/cli/init/index.md)

## Synopsis

```bash
flue init [directory] [--target <node|cloudflare>] [--deploy] [--force]
```

## Description

`flue init` scaffolds a complete Flue project skeleton: `flue.config.ts`, `package.json`, TypeScript setup, a Hello agent, and — depending on your choices — the HTTP server files. Two choices shape the skeleton: the build target (`node` or `cloudflare`) and whether to include the HTTP server setup. Both are resolved from flags when passed, and prompted for interactively otherwise.

`[directory]` is the directory to scaffold into, resolved from the current working directory and created (with parents) when it does not exist. It defaults to the current directory. The directory’s basename, lowercased and restricted to `[a-z0-9-]`, becomes the `package.json` name and (for the Cloudflare target) the Worker name; a basename with no valid characters falls back to `my-flue-app`.

`flue init` writes files only — it does not install dependencies. The printed next steps (and the generated README) begin with `npm install`.

## Options

| Option             | Description                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| \--target <target> | Build target: node or cloudflare. When omitted, flue init prompts for it; without a terminal, omitting it is an error. Any other value is rejected: Invalid target: "bogus". Supported targets: node, cloudflare.                    |
| \--deploy          | Include the HTTP server setup (vite.config.ts, src/app.ts, and the Hono and Vite dependencies). Off by default for the node target. The cloudflare target always deploys, so \--target cloudflare implies \--deploy.                 |
| \--root <path>     | Directory to scaffold into; identical to the positional argument. Passing both is rejected: Pass the directory as an argument or with --root, not both.                                                                              |
| \--force           | Scaffold into a non-empty directory without confirmation, and overwrite every file in the skeleton that already exists (including flue.config.\*). Without \--force, an existing file is left alone and reported as “kept existing”. |

A flag may be passed at most once (`--target may only be passed once.`). Unknown flags, extra positional arguments, and arguments after a bare `--` are rejected.

## Generated files

Every skeleton contains:

- `flue.config.ts`
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.env`
- `src/agents/hello.ts`
- `AGENTS.md`
- `README.md`
- `vite.config.ts` (`--deploy` only)
- `src/app.ts` (`--deploy` only)
- `src/db.ts` (Node only)
- `src/cloudflare.ts` (Cloudflare only)

## Examples

```bash
flue init                                  # prompt for everything, scaffold into the current directory
flue init ./my-agent-app                   # prompt, scaffold into ./my-agent-app (created if missing)
flue init --target node                    # local-run skeleton, no prompts
flue init --target node --deploy           # Node server skeleton
flue init ./bot --target cloudflare        # Cloudflare skeleton (--deploy implied)
flue init --target node --force            # scaffold into a non-empty directory, overwrite flue.config.*
```

## Docs Navigation

Current page: [flue init](https://flueframework.com/docs/cli/init/)

### Sections

- [Guide](https://flueframework.com/docs/guide/getting-started/)
- [Reference](https://flueframework.com/docs/reference/agent-api/)
- [CLI](https://flueframework.com/docs/cli/overview/)
- [Agent SDK](https://flueframework.com/docs/sdk/overview/)
- [Ecosystem](https://flueframework.com/docs/ecosystem/)

### CLI

- [Overview](https://flueframework.com/docs/cli/overview/)
- [init](https://flueframework.com/docs/cli/init/)
- [run](https://flueframework.com/docs/cli/run/)
- [add](https://flueframework.com/docs/cli/add/)
- [update](https://flueframework.com/docs/cli/update/)
- [docs](https://flueframework.com/docs/cli/docs/)
