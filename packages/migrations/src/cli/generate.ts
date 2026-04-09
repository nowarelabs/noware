import { defineCommand } from "citty";
import { consola } from "consola";
import { pascalCase, camelCase, snakeCase } from "scule";
import * as fs from "node:fs/promises";
import * as path from "pathe";

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate a new migration file",
  },
  args: {
    name: {
      type: "positional",
      description: "Name of the migration (e.g., create_users_table)",
      required: true,
    },
    do: {
      type: "boolean",
      description: "Generate a migration for a Durable Object",
      default: false,
    },
    doType: {
      type: "string",
      description: "Durable Object type (view, queue, search, lock, logic, cache, session, state)",
    },
    populateFrom: {
      type: "string",
      description: "Comma-separated list of tables this DO populates from (e.g., tournaments,brackets,matches)",
    },
    doClass: {
      type: "string",
      description: "Custom Durable Object class name",
    },
  },
  async run({ args }) {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, "0"),
      now.getDate().toString().padStart(2, "0"),
      now.getHours().toString().padStart(2, "0"),
      now.getMinutes().toString().padStart(2, "0"),
      now.getSeconds().toString().padStart(2, "0"),
    ].join("");

    const isDO = args.do as boolean;
    const location = isDO ? "do" : "d1";
    const doType = args.doType as string | undefined;
    const populateFromRaw = args.populateFrom as string | undefined;
    const populateFrom = populateFromRaw ? populateFromRaw.split(",").map(s => s.trim()) : [];
    const doClass = args.doClass as string | undefined;

    const fileName = `${timestamp}_${args.name}.ts`;
    const migrationsDir = path.join(process.cwd(), "src/db/migrate");

    await fs.mkdir(migrationsDir, { recursive: true });

    const filePath = path.join(migrationsDir, fileName);
    const content = generateMigrationTemplate(args.name as string, timestamp, {
      location,
      doType: isDO ? (doType || "view") : undefined,
      populateFrom: isDO ? populateFrom : [],
      doClass,
    });

    await fs.writeFile(filePath, content);
    consola.success(`Migration created: src/db/migrate/${fileName}`);

    if (isDO) {
      consola.info(`Durable Object migration generated with type: ${doType || "view"}`);
      if (populateFrom.length > 0) {
        consola.info(`Populate from: ${populateFrom.join(", ")}`);
      }
      consola.info(`Edit the file to add columns, then run 'pnpm db:scaffold --all' to generate the full project.`);
    } else {
      consola.info(`Edit the file to add columns, then run 'pnpm db:scaffold --all' to generate the full project.`);
    }
  },
});

function generateMigrationTemplate(
  name: string,
  version: string,
  options: {
    location?: "d1" | "do";
    doType?: string;
    populateFrom?: string[];
    doClass?: string;
  } = {},
): string {
  const className = pascalCase(name);
  const isDO = options.location === "do";
  const doClassName = options.doClass || className;
  const populateFrom = options.populateFrom || [];

  let content = `import { Migration } from "nomo/migrations";\n\n`;
  content += `export default class ${className} extends Migration {\n`;
  content += `  readonly version = "${version}";\n`;

  if (isDO) {
    content += `  readonly durableObjectClass = '${doClassName}';\n\n`;
    content += `  async change() {\n`;
    content += `    const options = { location: 'do' as const };\n\n`;
    content += `    await this.createTable('${snakeCase(name)}', options, (t) => {\n`;
    content += `      t.id({ autoincrement: true });\n`;
  } else {
    content += `\n  async change() {\n`;
    content += `    const options = { location: 'd1' as const };\n\n`;
    content += `    await this.createTable('${snakeCase(name)}', options, (t) => {\n`;
    content += `      t.text('id', { primaryKey: true, notNull: true });\n`;
  }

  content += `      // t.text('name', { notNull: true });\n`;
  content += `      // t.integer('count', { notNull: true, default: 0 });\n`;
  content += `      // t.foreignKey('parent_id', 'parents', 'id', { onDelete: 'cascade' });\n`;
  content += `      // t.belongsTo('parents', { name: 'parent', foreignKey: 'parent_id' });\n`;
  content += `      // t.hasMany('children', { name: 'children', foreignKey: 'parent_id' });\n`;
  content += `      t.timestamps();\n`;

  if (isDO) {
    content += `\n`;
    content += `      t.doType('${options.doType || "view"}');\n`;
    if (populateFrom.length > 0) {
      content += `      t.populateFrom(${populateFrom.map(t => `'${t}'`).join(", ")});\n`;
    }
  }

  content += `    });\n`;
  content += `  }\n`;
  content += `}\n`;

  return content;
}
