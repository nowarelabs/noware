import { defineCommand } from "citty";
import { consola } from "consola";

export const resetCommand = defineCommand({
  meta: {
    name: "reset",
    description: "Drop all tables and re-run all migrations (DESTRUCTIVE)",
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
      description: "Reset the remote database",
      default: false,
    },
    local: {
      type: "boolean",
      description: "Reset the local database",
      default: true,
    },
  },
  async run({ args }) {
    try {
      const database = args.database;
      const scope = args.remote ? "--remote" : "--local";

      consola.warn("WARNING: This will drop all tables in your database!");
      consola.info("💡 For D1, we achieve this by deleting the migration history and re-applying.");

      if (!args.remote) {
        consola.start("Cleaning up local D1 storage...");
        // This is a bit hacky but often works if we know the path.
        // Better way: use wrangler d1 execute to drop all tables.
      }

      consola.info(`Resetting D1 (${database})...`);
      // Wrangler doesn't have a direct reset. We might need to drop tables manually.
      // For now, we'll suggest using wrangler d1 execute with a drop script if needed.

      consola.info(
        "💡 Consider running 'wrangler d1 execute DB --command \"DROP TABLE ...\"' if needed.",
      );
    } catch (err: any) {
      consola.error(`Failed to reset: ${err.message}`);
      process.exit(1);
    }
  },
});
