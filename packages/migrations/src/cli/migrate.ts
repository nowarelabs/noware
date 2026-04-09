import { defineCommand } from "citty";
import { consola } from "consola";
import { execSync } from "node:child_process";
import { MigrationCompiler } from "./compiler";

export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "Apply pending migrations to the D1 database",
  },
  args: {
    version: {
      type: "positional",
      description: "Target version to migrate to",
      required: false,
    },
    database: {
      type: "string",
      alias: "d",
      description: "D1 database binding or name",
      default: "DB",
    },
    remote: {
      type: "boolean",
      description: "Apply migrations to the remote database",
      default: false,
    },
    local: {
      type: "boolean",
      description: "Apply migrations to the local database",
      default: true,
    },
  },
  async run({ args }) {
    consola.start("Preparing migrations...");

    // 1. Compile TS to SQL first
    const compiler = new MigrationCompiler();
    const compileRes = await compiler.compile();

    if (!compileRes.success) {
      consola.error(`Failed to compile migrations: ${compileRes.error}`);
      process.exit(1);
    }

    // 2. Build wrangler command
    const database = args.database;
    const scope = args.remote ? "--remote" : "--local";

    consola.info(`Applying migrations to D1 (${database})...`);

    try {
      execSync(`pnpm wrangler d1 migrations apply ${database} ${scope}`, {
        stdio: "inherit",
      });
      consola.success("Migrations applied successfully!");
    } catch (err: any) {
      consola.error(`Failed to execute wrangler command: ${err.message}`);
      process.exit(1);
    }
  },
});
