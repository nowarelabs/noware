/// <reference types="node" />

import { join } from "node:path";
import { access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import type { CodebaseFs } from "./index.ts";

/**
 * The node implementation of `CodebaseFs` for use by `@nowarelabs/gen-diesel`
 * consumers that run on node (CLI tools, the agent runtime, tests).
 *
 * Lives behind the `@nowarelabs/gen-diesel/node` subpath so the core entry
 * stays free of node builtins and remains Workers-safe.
 *
 * @param root Optional base directory. When provided, all relative paths are
 *   resolved against it (e.g. `"."` maps to `root`). When omitted, paths
 *   resolve against the process working directory.
 */
export function createNodeCodebaseFs(root?: string): CodebaseFs {
  const resolve = (path: string) => (root ? join(root, path) : path);
  return {
    async readFile(path) {
      return new Uint8Array(await readFile(resolve(path)));
    },
    async writeFile(path, data) {
      await writeFile(resolve(path), data);
    },
    async deleteFile(path) {
      try {
        await unlink(resolve(path));
      } catch (e) {
        if ((e as { code?: string })?.code !== "ENOENT") throw e;
      }
    },
    async exists(path) {
      try {
        await access(resolve(path));
        return true;
      } catch {
        return false;
      }
    },
    async readDir(path) {
      return readdir(resolve(path));
    },
  };
}
