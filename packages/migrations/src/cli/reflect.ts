import { defineCommand } from "citty";
import { consola } from "consola";
import { SchemaReflector } from "./reflector";
import * as fs from "node:fs/promises";
import * as path from "pathe";

export const reflectCommand = defineCommand({
  meta: {
    name: "reflect",
    description: "Generate Drizzle, Zod, and TypeScript schemas from a D1 database or SQL export",
  },
  args: {
    file: {
      type: "positional",
      description: "Optional SQL file to parse",
      required: false,
    },
    db: {
      type: "string",
      description: "D1 database name to export from",
    },
    out: {
      type: "string",
      alias: "o",
      description: "Output directory for schemas",
      default: "src/db/schema",
    },
    remote: {
      type: "boolean",
      description: "Force remote export (default is local)",
      default: false,
    },
  },
  async run({ args }) {
    try {
      // Read metadata if it exists
      const metadataPath = path.resolve(process.cwd(), ".nomo/temp_metadata.json");
      let metadata: Record<string, unknown[]> = {};
      try {
        const content = await fs.readFile(metadataPath, "utf-8");
        metadata = JSON.parse(content);
      } catch (e) {
        consola.log(e);
      }

      const reflector = new SchemaReflector({
        outDir: args.out,
        metadata,
      });

      await reflector
        .source(args.file, { db: args.db, remote: args.remote })
        .then((r) => r.prepare())
        .then((r) => r.extract())
        .then((r) => r.generate());

      await fs.rm(metadataPath, { force: true }).catch(() => {});
    } catch (err: unknown) {
      consola.error(`Failed to reflect schema: ${err.message}`);
      process.exit(1);
    }
  },
});
