import type { SystemSpec, TableSpec, BindingSpec, MigrationSpec } from "@nowarelabs/shared";

export class ConfigGenerator {
  generate(spec: SystemSpec): string {
    const lines: string[] = [
      `name = "${spec.name.toLowerCase().replace(/\s+/g, "-")}"`,
      `main = "src/index.ts"`,
      `compatibility_date = "2024-01-01"`,
      "",
    ];

    for (const binding of spec.bindings) {
      lines.push(`[[${binding.type}]]`);
      lines.push(`binding = "${binding.name}"`);
      lines.push(`database_id = "${binding.resource}"`);
      lines.push("");
    }

    return lines.join("\n");
  }

  generateDatabaseMigration(tables: TableSpec[]): string {
    const lines: string[] = [];
    for (const table of tables) {
      const columns = table.columns.map((c) => {
        const parts = [c.name, c.type];
        if (c.primaryKey) parts.push("PRIMARY KEY");
        if (!c.nullable) parts.push("NOT NULL");
        if (c.defaultValue !== undefined) parts.push(`DEFAULT ${c.defaultValue}`);
        return `  ${parts.join(" ")}`;
      });
      lines.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);
      lines.push(columns.join(",\n"));
      lines.push(");");

      for (const idx of table.indexes) {
        const unique = idx.unique ? "UNIQUE " : "";
        lines.push(
          `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name} (${idx.columns.join(", ")});`,
        );
      }
    }
    return lines.join("\n\n");
  }

  generateBindings(bindings: BindingSpec[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const binding of bindings) {
      result[binding.name] = { binding: binding.type, id: binding.resource };
    }
    return result;
  }

  generateMigration(migration: MigrationSpec): string {
    return `-- Migration v${migration.version}\n${migration.sql}`;
  }
}
