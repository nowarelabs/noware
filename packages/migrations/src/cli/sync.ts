import { defineCommand } from "citty";
import { consola } from "consola";
import { MigrationCompiler } from "./compiler";
import { SchemaReflector } from "./reflector";
import * as fs from "node:fs/promises";
import * as path from "pathe";
import { WranglerConfigUpdater } from "./config";

export const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Capture schema changes: compile, reflect to Drizzle, and update Wrangler",
  },
  args: {
    database: {
      type: "string",
      alias: "d",
      description: "D1 database name for reflection",
    },
    out: {
      type: "string",
      alias: "o",
      description: "Output directory for schemas",
      default: "src/db/schema",
    },
    remote: {
      type: "boolean",
      description: "Reflect from remote database",
      default: false,
    },
  },
  async run({ args }) {
    consola.start("Starting Sync workflow...");

    // 1. Compile TS to SQL
    consola.info("Compiling migrations...");
    const compiler = new MigrationCompiler();
    const compileRes = await compiler.compile();

    if (!compileRes.success) {
      consola.error(`Sync failed (compile error): ${compileRes.error}`);
      process.exit(1);
    }

    // 2. Reflect schema to Drizzle
    consola.info("Reflecting schema to Drizzle/Zod...");

    // Read metadata if it exists
    const metadataPath = path.resolve(process.cwd(), ".nomo/temp_metadata.json");
    let metadata: Record<string, any[]> = {};
    try {
      const content = await fs.readFile(metadataPath, "utf-8");
      metadata = JSON.parse(content);
    } catch (e) {}

    const reflector = new SchemaReflector({
      outDir: args.out,
      metadata,
    });

    // If we have a database name, reflect from there.
    // Otherwise, reflect from the newly compiled SQL files.
    if (args.database) {
      await reflector.source(undefined, {
        db: args.database,
        remote: args.remote,
      });
    } else {
      const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
      const files = (await fs.readdir(migrationsDir))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      if (files.length > 0) {
        // Combine all SQL files into a temporary schema file for reflection
        const tempSchemaPath = path.resolve(process.cwd(), "temp_sync_schema.sql");
        let schemaSql = "";
        for (const file of files) {
          schemaSql += (await fs.readFile(path.join(migrationsDir, file), "utf-8")) + "\n";
        }
        await fs.writeFile(tempSchemaPath, schemaSql);
        await reflector.source(tempSchemaPath);
      } else {
        consola.warn("No SQL migrations found to reflect.");
      }
    }

    await reflector.prepare();
    await reflector.extract();
    await reflector.generate();

    // Cleanup temp sync files
    const tempSchemaPath = path.resolve(process.cwd(), "temp_sync_schema.sql");
    await fs.rm(tempSchemaPath, { force: true }).catch(() => {});
    await fs.rm(metadataPath, { force: true }).catch(() => {});

    // 3. Update Wrangler Configuration
    consola.info("Updating Wrangler configuration...");
    await updateWranglerConfig();

    consola.success("Sync complete! Your migrations, Drizzle schemas, and Wrangler config are in sync.");
  },
});

async function updateWranglerConfig() {
  const wranglerPath = path.resolve(process.cwd(), "wrangler.jsonc");
  if (!(await fs.stat(wranglerPath).catch(() => null))) {
    consola.info("Skip: wrangler.jsonc not found.");
    return;
  }

  try {
    const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
    const sqlFiles = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const tags = sqlFiles.map((f) => f.replace(".sql", ""));

    const configRes = await WranglerConfigUpdater.fromFile(wranglerPath);

    if (configRes.success) {
      const updater = configRes.data;
      const updateRes = updater.addMigrations(tags);

      if (updateRes.success) {
        const saveRes = await updater.save();
        if (saveRes.success) {
          consola.success("Updated wrangler.jsonc with migration tags.");
        } else {
          consola.warn(`Failed to save wrangler.jsonc: ${saveRes.error}`);
        }
      } else {
        const err = updateRes.error;
        const errMsg = typeof err === "string" ? err : (err as any)?.message;
        if (errMsg === "Migrations array not found in configuration") {
          consola.warn("'migrations' array not found in wrangler.jsonc. You might need to add it manually.");
        } else {
          consola.success("Wrangler migration tags are already up to date.");
        }
      }
    } else {
      consola.warn(`Failed to read wrangler.jsonc: ${configRes.error}`);
    }
  } catch (err: any) {
    consola.warn(`Failed to update wrangler.jsonc: ${err.message}`);
  }
}
