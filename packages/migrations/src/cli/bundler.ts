import { type Result, ok, safeAsync } from "nomo/result";
import * as fs from "node:fs/promises";
import * as path from "pathe";
import { CodeBuilder } from "./builder";
import * as templates from "./templates";

export class MigrationBundler {
  private inputDir: string;
  private outputPath: string;

  constructor() {
    this.inputDir = path.resolve(process.cwd(), "src/db/migrations");
    this.outputPath = path.resolve(
      process.cwd(),
      "src/db/migrations/migrations.ts",
    );
  }

  /**
   * Set input directory containing .sql migrations
   */
  from(dir: string): this {
    this.inputDir = path.resolve(process.cwd(), dir);
    return this;
  }

  /**
   * Set output TypeScript file path
   */
  to(file: string): this {
    this.outputPath = path.resolve(process.cwd(), file);
    return this;
  }

  /**
   * Bundle SQL migrations into a TypeScript module
   */
  async bundle(): Promise<Result<this>> {
    return await safeAsync(async () => {
      console.log(
        `\n📦 Bundling SQL migrations from ${path.relative(process.cwd(), this.inputDir)}...`,
      );

      if (!(await fs.stat(this.inputDir).catch(() => null))) {
        throw new Error(`Input directory ${this.inputDir} does not exist.`);
      }

      const files = await fs.readdir(this.inputDir);
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort(); // Ensure consistent order

      if (sqlFiles.length === 0) {
        console.warn(`⚠️  No .sql files found in ${this.inputDir}`);
      }

      const builder = new CodeBuilder().append(templates.BUNDLE_HEADER);

      for (const file of sqlFiles) {
        const filePath = path.join(this.inputDir, file);
        const sql = await fs.readFile(filePath, "utf-8");

        // Extract durableObjectClass from metadata comment if present
        let durableObjectClass: string | undefined;
        const firstLine = sql.split("\n")[0];
        const match = firstLine.match(/-- @durableObjectClass:\s+(\w+)/);
        if (match) {
          durableObjectClass = match[1];
        }

        // Escape backticks for JS template literal safety
        const escapedSql = sql.replace(/`/g, "\\`").replace(/\${/g, "\\${");

        builder.render(templates.BUNDLE_ITEM, {
          name: file.replace(".sql", ""),
          sql: escapedSql,
          durableObjectClass: durableObjectClass
            ? `,\n    durableObjectClass: '${durableObjectClass}'`
            : "",
        });
      }

      builder.append(templates.BUNDLE_FOOTER);

      await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
      await fs.writeFile(this.outputPath, builder.toString());

      console.log(
        `✅ Success! Bundled ${sqlFiles.length} migrations to ${path.relative(process.cwd(), this.outputPath)}`,
      );
      return this;
    });
  }
}
