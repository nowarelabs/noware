import * as fs from "node:fs/promises";
import * as path from "pathe";
import { Result, ok, err, tryAsync } from "nomo/result";

export interface MigrationEntry {
  tag: string;
}

export interface WranglerConfig {
  migrations?: MigrationEntry[];
  [key: string]: any;
}

export class WranglerConfigUpdater {
  private content: string;
  private configPath: string;
  private migrations: MigrationEntry[] = [];
  private migrationsRange: [number, number] | null = null;

  private constructor(configPath: string, content: string) {
    this.configPath = configPath;
    this.content = content;
    this.parseMigrations();
  }

  /**
   * Load and initialize the updater from a file.
   */
  static async fromFile(configPath: string): Promise<Result<WranglerConfigUpdater>> {
    return await tryAsync(async () => {
      const content = await fs.readFile(configPath, "utf-8");
      return new WranglerConfigUpdater(configPath, content);
    });
  }

  /**
   * Parse the migrations array from the JSONC content.
   * This uses a surgical approach to find the migrations block while preserving the rest of the file.
   */
  private parseMigrations() {
    // 1. Find the start of "migrations": [
    const migrationsFieldMatch = this.content.match(/"migrations"\s*:\s*\[/);
    if (!migrationsFieldMatch) {
      this.migrationsRange = null;
      this.migrations = [];
      return;
    }

    const start = migrationsFieldMatch.index!;
    const arrayStart = start + migrationsFieldMatch[0].indexOf("[");

    // 2. Find the matching closing bracket ]
    let depth = 0;
    let end = -1;
    for (let i = arrayStart; i < this.content.length; i++) {
      const char = this.content[i];
      if (char === "[") depth++;
      else if (char === "]") depth--;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    if (end === -1) {
      this.migrationsRange = null;
      this.migrations = [];
      return;
    }

    this.migrationsRange = [start, end];
    const innerContent = this.content.substring(arrayStart + 1, end - 1);

    // Extract tags from the inner content using a simpler regex since we just need the values
    const tagMatches = innerContent.match(/"tag"\s*:\s*"([^"]+)"/g) || [];
    this.migrations = tagMatches.map((t) => {
      const match = t.match(/"tag"\s*:\s*"([^"]+)"/);
      return { tag: match![1] };
    });
  }

  /**
   * Add new migration tags if they don't already exist.
   */
  addMigrations(tags: string[]): Result<this> {
    const existingTags = new Set(this.migrations.map((m) => m.tag));
    const newEntries: MigrationEntry[] = [];

    for (const tag of tags) {
      if (!existingTags.has(tag)) {
        newEntries.push({ tag });
        this.migrations.push({ tag });
      }
    }

    if (newEntries.length === 0) {
      return ok(this);
    }

    // If we don't have a migrations array yet, we'd need to add it.
    // For now, based on sync.ts logic, we assume it exists or warn.
    if (!this.migrationsRange) {
      return err("Migrations array not found in configuration");
    }

    this.updateContent(newEntries);
    return ok(this);
  }

  /**
   * Surgically update the content string with new migrations.
   */
  private updateContent(newEntries: MigrationEntry[]) {
    if (!this.migrationsRange) return;

    const [start, end] = this.migrationsRange;
    const migrationsBlock = this.content.substring(start, end);
    const arrayStart = migrationsBlock.indexOf("[");
    const arrayEnd = migrationsBlock.lastIndexOf("]");

    if (arrayStart === -1 || arrayEnd === -1) return;

    let innerContent = migrationsBlock.substring(arrayStart + 1, arrayEnd).trim();
    if (innerContent && !innerContent.endsWith(",")) {
      innerContent += ",";
    }

    for (const entry of newEntries) {
      innerContent += `\n\t\t{\n\t\t\t"tag": "${entry.tag}"\n\t\t},`;
    }

    // Remove last comma
    innerContent = innerContent.replace(/,$/, "");

    const newMigrationsBlock =
      migrationsBlock.substring(0, arrayStart + 1) +
      `\n\t\t${innerContent}\n\t` +
      migrationsBlock.substring(arrayEnd);
    this.content =
      this.content.substring(0, start) + newMigrationsBlock + this.content.substring(end);

    // Re-parse to update ranges for any subsequent updates (though unlikely in current flow)
    this.parseMigrations();
  }

  /**
   * Save the updated configuration to disk.
   */
  async save(): Promise<Result<void>> {
    return await tryAsync(async () => {
      await fs.writeFile(this.configPath, this.content, "utf-8");
    });
  }
}
