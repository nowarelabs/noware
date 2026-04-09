import { Command } from "commander";
import * as fs from "node:fs/promises";
import * as path from "pathe";
import { DO_TEMPLATE, patchWranglerConfig, ensureSuffix } from "../src/generators";

export const doCommand = new Command("do")
  .description("Generate a new Durable Object")
  .argument("<name>", "Name of the Durable Object (e.g., UserSession)")
  .action(async (rawName: string) => {
    const name = ensureSuffix(rawName, "DurableObject");
    const targetDir = path.join(process.cwd(), "src/durable_objects");
    const filePath = path.join(targetDir, `${name}.ts`);
    const indexFile = path.join(targetDir, "index.ts");
    const wranglerPath = path.join(process.cwd(), "wrangler.jsonc");

    // 1. Check directories
    if (!(await fs.stat(targetDir).catch(() => null))) {
      console.error(`❌ Target directory not found: ${targetDir}`);
      process.exit(1);
    }

    if (await fs.stat(filePath).catch(() => null)) {
      console.error(`❌ File already exists: ${filePath}`);
      process.exit(1);
    }

    // 2. Write file
    await fs.writeFile(filePath, DO_TEMPLATE(name));
    console.log(`✅ Created ${filePath}`);

    // 3. Update index
    const exportLine = `export * from "./${name}";\n`;
    await fs.appendFile(indexFile, exportLine);
    console.log(`✅ Updated ${indexFile}`);

    // 4. Update wrangler.jsonc
    if (await fs.stat(wranglerPath).catch(() => null)) {
      const wranglerContent = await fs.readFile(wranglerPath, "utf-8");
      const updatedContent = patchWranglerConfig(wranglerContent, "do", name);
      await fs.writeFile(wranglerPath, updatedContent);
      console.log(`✅ Updated ${wranglerPath}`);
    }
  });
