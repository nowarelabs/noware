import { defineCommand } from "citty";
import { consola } from "consola";
import { execSync } from "node:child_process";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show the status of D1 migrations",
  },
  args: {
    database: {
      type: "string",
      alias: "d",
      description: "D1 database binding or name",
      default: "DB",
    },
    remote: {
      type: "boolean",
      description: "Check status of the remote database",
      default: false,
    },
    local: {
      type: "boolean",
      description: "Check status of the local database",
      default: true,
    },
  },
  async run({ args }) {
    const database = args.database;
    const scope = args.remote ? "--remote" : "--local";

    consola.info(`Checking migration status for D1 (${database})...`);

    try {
      execSync(`pnpm wrangler d1 migrations list ${database} ${scope}`, {
        stdio: "inherit",
      });
    } catch (err: any) {
      consola.error(`Failed to get status: ${err.message}`);
      process.exit(1);
    }
  },
});
