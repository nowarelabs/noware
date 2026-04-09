import { defineCommand } from "citty";
import { consola } from "consola";
import { MigrationBundler } from "./bundler";

export const bundleCommand = defineCommand({
  meta: {
    name: "bundle",
    description: "Bundle SQL migrations into a TypeScript module for Durable Objects",
  },
  args: {
    input: {
      type: "string",
      alias: "i",
      description: "Input directory containing .sql migrations",
      default: "src/db/migrations",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output TypeScript file path",
      default: "src/db/migrations/migrations.ts",
    },
  },
  async run({ args }) {
    try {
      const bundler = new MigrationBundler();

      const res = await bundler.from(args.input).to(args.output).bundle();
      if (!res.success) {
        consola.error(`Failed to bundle migrations: ${res.error}`);
        process.exit(1);
      }
      consola.success(`Migrations bundled to ${args.output}`);
    } catch (err: any) {
      consola.error(`Failed to bundle migrations: ${err.message}`);
      process.exit(1);
    }
  },
});
