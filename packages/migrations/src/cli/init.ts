import { defineCommand } from "citty";
import { consola } from "consola";
import * as fs from "node:fs/promises";
import * as path from "pathe";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold the database directory structure in your project",
  },
  async run() {
    const cwd = process.cwd();
    const dirs = [path.join(cwd, "db/migrations"), path.join(cwd, "db/schema")];

    consola.start("🏗️  Scaffolding database directory structure...");

    for (const dir of dirs) {
      if (!(await fs.stat(dir).catch(() => null))) {
        await fs.mkdir(dir, { recursive: true });
        // Add a .gitkeep to ensure the directory is tracked
        await fs.writeFile(path.join(dir, ".gitkeep"), "");
        consola.success(`Created: ${path.relative(cwd, dir)}`);
      } else {
        consola.info(`Skip: ${path.relative(cwd, dir)} already exists`);
      }
    }

    consola.log("");
    consola.success(
      "Done! You can now run 'pnpm migrate generate <name>' to create your first migration.",
    );
  },
});
