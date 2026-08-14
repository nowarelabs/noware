/// <reference types="node" />

import { access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import type { CodebaseFs } from "./index.ts";

/**
 * The node implementation of `CodebaseFs` for use by `@nowarelabs/gen-diesel`
 * consumers that run on node (CLI tools, the agent runtime, tests).
 *
 * Lives behind the `@nowarelabs/gen-diesel/node` subpath so the core entry
 * stays free of node builtins and remains Workers-safe.
 *
 * `deleteFile` swallows `ENOENT` so idempotent pipelines never blow up on a
 * file that was already removed; `exists` follows the same rule.
 */
export function createNodeCodebaseFs(): CodebaseFs {
  return {
    async readFile(path) {
      return new Uint8Array(await readFile(path));
    },
    async writeFile(path, data) {
      await writeFile(path, data);
    },
    async deleteFile(path) {
      try {
        await unlink(path);
      } catch (e) {
        if ((e as { code?: string })?.code !== "ENOENT") throw e;
      }
    },
    async exists(path) {
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    },
    async readDir(path) {
      return readdir(path);
    },
  };
}
