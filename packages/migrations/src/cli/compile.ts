import { defineCommand } from "citty";
import { consola } from "consola";
import { MigrationCompiler } from "./compiler";
import { MigrationBundler } from "./bundler";

export const compileCommand = defineCommand({
  meta: {
    name: "compile",
    description: "Compile TS migrations into SQL files for D1",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Directory containing TS migrations",
      default: "db/migrations",
    },
    out: {
      type: "string",
      alias: "o",
      description: "Output directory for SQL files",
      default: "migrations",
    },
    bundle: {
      type: "boolean",
      alias: "b",
      description: "Automatically run bundle command after compilation",
      default: false,
    },
  },
  async run({ args }) {
    const compiler = new MigrationCompiler();

    const compileRes = await compiler.from(args.dir).to(args.out).compile();

    if (!compileRes.success) {
      consola.error("Failed to compile migrations:", compileRes.error);
      process.exit(1);
    }

    if (args.bundle) {
      consola.start("Automatically bundling for Durable Objects...");
      const bundler = new MigrationBundler();
      const bundleRes = await bundler.from(args.out).to("db/migrations/bundle.ts").bundle();

      if (!bundleRes.success) {
        consola.error(`Failed to bundle migrations: ${bundleRes.error}`);
        process.exit(1);
      }
    }

    consola.success("Done! Run 'pnpm wrangler d1 migrations apply DB --local' to apply.");
  },
});
