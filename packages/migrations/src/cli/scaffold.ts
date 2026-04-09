import { defineCommand } from "citty";
import { consola } from "consola";
import * as fs from "node:fs/promises";
import * as path from "pathe";
import { spawnSync } from "node:child_process";
import * as i from "inflection";
import { downloadTemplate } from "giget";
import { hash } from "ohash";
import { tmpdir } from "node:os";

const camelCase = (str: string) => i.camelize(str, true);
const pascalCase = (str: string) => i.camelize(str, false);
const snakeCase = (str: string) => i.underscore(str);
const _pluralize = (str: string) => i.pluralize(str);
const _singularize = (str: string) => i.singularize(str);
const titleize = (str: string) => i.titleize(str);

const classify = (tableName: string) => i.classify(tableName);
const tableize = (typeName: string) => i.tableize(typeName);

export interface Field {
  name: string;
  type: string;
  options: Record<string, any>;
  relationship?: {
    type: "hasMany" | "belongsTo" | "hasOne";
    target: string;
    foreignKey?: string;
    name?: string;
  };
}

export interface ParsedMigration {
  tableName: string;
  className: string;
  fields: Field[];
  location: "d1" | "do";
  durableObjectClass?: string;
  doType?: string;
  populateFrom: string[];
  doModel?: string;
  foreignKeys: { column: string; toTable: string; toColumn: string; onDelete?: string }[];
  indexes: { columns: string[] }[];
  filePath: string;
}

export interface ParsedMigrationFile {
  filePath: string;
  className: string;
  migrations: ParsedMigration[];
}

// ═════════════════════════════════════════════════════════════════════════════
// ADAPTER PATTERN — Template Loading
//
// ITemplateLoader: Interface defining the contract for loading templates
// LocalTemplateLoader: Loads templates from filesystem
// RemoteTemplateLoader: Downloads from remote URL, then delegates to Local
// ═════════════════════════════════════════════════════════════════════════════

interface ITemplateLoader {
  load(name: string): Promise<string>;
}

class LocalTemplateLoader implements ITemplateLoader {
  constructor(private readonly templateDir: string) {}

  async load(name: string): Promise<string> {
    try {
      const filePath = path.join(this.templateDir, `${name}.t`);
      return await fs.readFile(filePath, "utf-8");
    } catch {
      consola.error(`Template not found: ${name}.t in ${this.templateDir}`);
      process.exit(1);
    }
  }
}

class RemoteTemplateLoader implements ITemplateLoader {
  private localLoader!: LocalTemplateLoader;
  private downloadPromise: Promise<void>;

  constructor(templateUrl: string) {
    const tempPath = path.join(tmpdir(), `nomo-scaffold-${hash(templateUrl)}`);
    
    this.downloadPromise = downloadTemplate(templateUrl, { 
      dir: tempPath, 
      force: true 
    }).then(({ dir }) => {
      this.localLoader = new LocalTemplateLoader(dir);
    }).catch((err) => {
      consola.error(`Failed to download template: ${err}`);
      process.exit(1);
    });
  }

  async load(name: string): Promise<string> {
    await this.downloadPromise;
    return this.localLoader.load(name);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE ENGINE
//
// Owns the mustache-style renderer (static) and delegates loading to whichever
// ITemplateLoader adapter was injected. Also exposes convenience render() that
// loads + renders in one step.
// ═════════════════════════════════════════════════════════════════════════════

const TEMPLATE_HELPERS: Record<string, (val: any) => string> = {
  pascalCase,
  camelCase,
  snakeCase,
};

class TemplateEngine {
  constructor(private readonly loader: ITemplateLoader) {}

  // ── Factory Methods ──────────────────────────────────────────────────────
  
  static fromLocalDir(templateDir: string): TemplateEngine {
    return new TemplateEngine(new LocalTemplateLoader(templateDir));
  }

  static fromRemoteUrl(url: string): TemplateEngine {
    return new TemplateEngine(new RemoteTemplateLoader(url));
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  
  async load(name: string): Promise<string> {
    return this.loader.load(name);
  }

  async render(templateName: string, vars: Record<string, any>): Promise<string> {
    const tpl = await this.load(templateName);
    return TemplateEngine.renderString(tpl, vars);
  }

  // ── Static Renderer (pure, no I/O) ──────────────────────────────────────
  
  static renderString(template: string, vars: Record<string, any>): string {
    let res = template;

    // {{#if key}}...{{/if}}
    res = res.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
      const val = vars[key];
      if (!val || (Array.isArray(val) && val.length === 0)) return "";
      return TemplateEngine.renderString(content, vars);
    });

    // {{#each key}}...{{/each}}
    res = res.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, key, content) => {
      const arr = vars[key];
      if (!Array.isArray(arr) || arr.length === 0) return "";
      return arr
        .map((item: any) => {
          let block = content;
          block = block.replace(/\{\{this\}\}/g, String(item));
          for (const [helperName, helperFn] of Object.entries(TEMPLATE_HELPERS)) {
            block = block.replace(
              new RegExp(`\\{\\{${helperName}\\s+this\\}\\}`, "g"),
              helperFn(String(item))
            );
          }
          return block;
        })
        .join("");
    });

    // {{helperName varName}}
    for (const [helperName, helperFn] of Object.entries(TEMPLATE_HELPERS)) {
      res = res.replace(
        new RegExp(`\\{\\{${helperName}\\s+(\\w+)\\}\\}`, "g"),
        (_match, key) => {
          const val = vars[key];
          if (val === undefined || val === null) return "";
          return helperFn(String(val));
        }
      );
    }

    // {{varName}}
    for (const [key, val] of Object.entries(vars)) {
      if (Array.isArray(val) || typeof val === "object") continue;
      const replacement = val === undefined || val === null ? "" : String(val);
      res = res.replaceAll(`{{${key}}}`, replacement);
    }

    return res;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// BUILDER PATTERN — Template Variables
//
// TemplateVarsBuilder accumulates all the data a template needs in discrete,
// named steps. Each "with" method enriches the vars bag and returns `this` for
// chaining. Call .build() to get the final immutable snapshot.
// ═════════════════════════════════════════════════════════════════════════════

class TemplateVarsBuilder {
  private vars: Record<string, any> = {};

  withMigration(parsed: ParsedMigration, typeName: string, modelFileName: string): this {
    const kebabTableName = parsed.tableName.replace(/_/g, '-');
    const singularTitle = titleize(_singularize(parsed.tableName)).replace(/\s+/g, '');
    const pluralTitle = titleize(_pluralize(parsed.tableName)).replace(/\s+/g, '');
    this.vars = {
      ...this.vars,
      typeName,
      pluralTypeName: pluralize(typeName),
      tableName: parsed.tableName,
      kebabTableName,
      modelFileName,
      location: parsed.location,
      modelPropertyName: camelCase(pluralize(typeName)),
      serviceClassName: `${pascalCase(pluralize(typeName))}Service`,
      pluralCamelName: pluralize(camelCase(typeName)),
      singularName: camelCase(modelNameFromTableName(parsed.tableName)),
      colCount: parsed.fields.filter((f) => !f.relationship).length + 2,
      doType: parsed.doType || "view",
      populateFrom: parsed.populateFrom,
      doModel: parsed.doModel,
      componentClassName: pluralTitle,
      viewClassName: singularTitle,
    };
    return this;
  }

  withFormFields(fields: Field[]): this {
    this.vars.createFormFields = this.buildCreateFormFields(fields);
    this.vars.editRowFields = this.buildEditRowFields(fields);
    this.vars.viewRowFields = this.buildViewRowFields(fields);
    this.vars.tableHeadFields = this.buildTableHeadFields(fields);
    this.vars.jsCreateData = this.buildJsData(fields, "form");
    this.vars.jsUpdateData = this.buildJsData(fields, "row");
    return this;
  }

  withDurableObject(doClassName: string, doType: string, populateFrom: string[]): this {
    this.vars = { ...this.vars, doClassName, doType, populateFrom };
    return this;
  }

  withExtra(extra: Record<string, any>): this {
    this.vars = { ...this.vars, ...extra };
    return this;
  }

  build(): Record<string, any> {
    return { ...this.vars };
  }

  // ── Private Field Rendering Helpers ──────────────────────────────────────

  private buildCreateFormFields(fields: Field[]): string {
    return fields
      .filter((f) => !f.relationship)
      .map((f) => {
        const placeholder = pascalCase(f.name);
        if (f.type === "boolean") {
          return `              <select name="${f.name}" className="edit-select">\n                <option value="true">True</option>\n                <option value="false">False</option>\n              </select>`;
        }
        return `              <input type="${f.type === "integer" ? "number" : "text"}" name="${f.name}" placeholder="${placeholder}" required className="edit-input" />`;
      })
      .join("\n");
  }

  private buildEditRowFields(fields: Field[]): string {
    return fields
      .filter((f) => !f.relationship)
      .map((f) => {
        if (f.type === "boolean") {
          return `              <td>\n                <select name="${f.name}" className="edit-select">\n                  <option value="true" nofo-selected="${f.name}">True</option>\n                  <option value="false" nofo-selected="${f.name}">False</option>\n                </select>\n              </td>`;
        }
        return `              <td><input type="${f.type === "integer" ? "number" : "text"}" name="${f.name}" value="{{${f.name}}}" required className="edit-input" /></td>`;
      })
      .join("\n");
  }

  private buildViewRowFields(fields: Field[]): string {
    return fields
      .filter((f) => !f.relationship)
      .map((f) => `              <td>{\`{{${f.name}}}\`}</td>`)
      .join("\n");
  }

  private buildTableHeadFields(fields: Field[]): string {
    return fields
      .filter((f) => !f.relationship)
      .map((f) => `              <th>${pascalCase(f.name)}</th>`)
      .join("\n");
  }

  private buildJsData(fields: Field[], source: "form" | "row"): string {
    return fields
      .filter((f) => !f.relationship)
      .map((f) => {
        let val =
          source === "form"
            ? `form.${f.name}.value`
            : `row.querySelector('[name="${f.name}"]').value`;
        if (f.type === "integer") val = `parseInt(${val})`;
        if (f.type === "boolean") val = `${val} === 'true'`;
        return `      ${f.name}: ${val},`;
      })
      .join("\n");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE METHOD PATTERN — FileGenerator Abstract Base Class
//
// generate() is the fixed algorithm skeleton:
//   1. Ensure output directory exists
//   2. Load + render template
//   3. Apply any post-processing (relationship injection, etc.)
//   4. Write to disk
//
// Subclasses only override the parts that differ: getTemplateName(),
// resolveTargetPath(), and optionally postProcess().
// ═════════════════════════════════════════════════════════════════════════════

abstract class FileGenerator {
  constructor(
    protected readonly engine: TemplateEngine,
    protected readonly projectRoot: string
  ) {}

  abstract getTemplateName(): string;
  abstract resolveTargetPath(vars: Record<string, any>): string;

  // Hook — subclasses may override for extra content injection
  protected postProcess(content: string, _vars: Record<string, any>, _fields: Field[]): string {
    return content;
  }

  async generate(vars: Record<string, any>, fields: Field[]): Promise<string> {
    const targetPath = this.resolveTargetPath(vars);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    const tpl = await this.engine.load(this.getTemplateName());
    const relationships = this.buildRelationships(fields);
    let content = TemplateEngine.renderString(tpl, { ...vars, relationships });
    content = this.postProcess(content, vars, fields);

    await fs.writeFile(targetPath, content);
    return targetPath;
  }

  protected buildRelationships(fields: Field[]): string {
    let relationships = "";
    for (const field of fields) {
      if (field.relationship) {
        const relName = field.relationship.name || field.relationship.target;
        const targetModel = pascalCase(field.relationship.target) + "Model";
        const fk = field.relationship.foreignKey || field.name;
        relationships += `\t\tthis.${field.relationship.type}("${relName}", { model: "${targetModel}", foreignKey: "${fk}" });\n`;
      } else if (field.options.references) {
        const targetModel = pascalCase(field.options.references) + "Model";
        const fk = field.name;
        relationships += `\t\tthis.belongsTo("${field.options.references}", { model: "${targetModel}", foreignKey: "${fk}" });\n`;
      }
    }
    return relationships;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FACTORY PATTERN — Concrete FileGenerator Subclasses
//
// Each class is a single-responsibility unit: it knows its template name and
// how to derive the output path from the vars object. Nothing else.
// FileGeneratorFactory.create() is the factory method that maps a string key
// to the right concrete class, keeping creation logic in one place.
// ═════════════════════════════════════════════════════════════════════════════

class ModelGenerator extends FileGenerator {
  getTemplateName() { return "model.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/models", `${vars.modelFileName}.ts`);
  }
}

class RpcGenerator extends FileGenerator {
  getTemplateName() { return "rpc.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/rpc", `${vars.tableName}.ts`);
  }
}

class RpcInstanceGenerator extends FileGenerator {
  getTemplateName() { return "rpc_instance.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    const fileName = `${vars.tableName}_rpc_instance`;
    return path.join(this.projectRoot, "src/rpc/instances", `${fileName}.ts`);
  }
}

class ControllerGenerator extends FileGenerator {
  getTemplateName() { return "controller.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/controllers", `${vars.tableName}_controller.ts`);
  }
}

class ControllerRpcGenerator extends FileGenerator {
  getTemplateName() { return "controller_rpc.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/controllers/rpcs", `${vars.tableName}.ts`);
  }
}

class ServiceGenerator extends FileGenerator {
  getTemplateName() { return "service.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/services", `${vars.tableName}_service.ts`);
  }
}

class ViewGenerator extends FileGenerator {
  getTemplateName() { return "view.tsx"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/views", vars.tableName, "index.tsx");
  }
}

class ComponentJsGenerator extends FileGenerator {
  getTemplateName() { return "component.js"; }
  resolveTargetPath(vars: Record<string, any>) {
    const kebabName = (vars.kebabTableName || vars.tableName).replace(/_/g, '-');
    return path.join(this.projectRoot, "public/components", `${kebabName}-table.js`);
  }
}

class ComponentCssGenerator extends FileGenerator {
  getTemplateName() { return "component.css"; }
  resolveTargetPath(vars: Record<string, any>) {
    const kebabName = (vars.kebabTableName || vars.tableName).replace(/_/g, '-');
    return path.join(this.projectRoot, "public/components", `${kebabName}-table.css`);
  }
}

class TypeFileGenerator extends FileGenerator {
  getTemplateName() { return "types.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/models/types", `${snakeCase(vars.typeName)}.ts`);
  }
}

class DurableObjectGenerator extends FileGenerator {
  getTemplateName() { return "durable_object.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/durable_objects", `${vars.doClassName}.ts`);
  }
}

class ControllerRpcViewGenerator extends FileGenerator {
  getTemplateName() { return "controller_rpc_view.ts"; }
  resolveTargetPath(vars: Record<string, any>) {
    return path.join(this.projectRoot, "src/controllers/rpcs/views", `${vars.tableName}.ts`);
  }
}

// ── Generator Type Registry ──────────────────────────────────────────────────

type GeneratorType =
  | "model"
  | "rpc"
  | "rpc_instance"
  | "controller"
  | "controller_rpc"
  | "service"
  | "view"
  | "component_js"
  | "component_css"
  | "type_file"
  | "durable_object"
  | "controller_rpc_view";

class FileGeneratorFactory {
  static create(
    type: GeneratorType,
    engine: TemplateEngine,
    projectRoot: string
  ): FileGenerator {
    const registry: Record<GeneratorType, new (e: TemplateEngine, r: string) => FileGenerator> = {
      model: ModelGenerator,
      rpc: RpcGenerator,
      rpc_instance: RpcInstanceGenerator,
      controller: ControllerGenerator,
      controller_rpc: ControllerRpcGenerator,
      service: ServiceGenerator,
      view: ViewGenerator,
      component_js: ComponentJsGenerator,
      component_css: ComponentCssGenerator,
      type_file: TypeFileGenerator,
      durable_object: DurableObjectGenerator,
      controller_rpc_view: ControllerRpcViewGenerator,
    };
    
    const Ctor = registry[type];
    if (!Ctor) throw new Error(`Unknown generator type: ${type}`);
    return new Ctor(engine, projectRoot);
  }

  /** Standard generators used for every D1 and DO migration */
  static createStandard(engine: TemplateEngine, projectRoot: string): FileGenerator[] {
    const standardTypes: GeneratorType[] = [
      "model",
      "rpc",
      "rpc_instance",
      "controller",
      "controller_rpc",
      "service",
      "view",
      "component_js",
      "component_css",
      "type_file",
    ];
    return standardTypes.map((t) => FileGeneratorFactory.create(t, engine, projectRoot));
  }

  /** Extra generators only used for Durable Object migrations */
  static createDurableObjectExtras(engine: TemplateEngine, projectRoot: string): FileGenerator[] {
    return [
      FileGeneratorFactory.create("durable_object", engine, projectRoot),
      FileGeneratorFactory.create("controller_rpc_view", engine, projectRoot),
    ];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SCHEMA GENERATOR (Special Generator)
//
// Specialized generator that doesn't follow the simple "write one file"
// pattern. It appends to, or force-replaces an entry in, the shared schema.ts
// file. Extends FileGenerator so it still participates in the same overall
// architecture but overrides generate() entirely.
// ═════════════════════════════════════════════════════════════════════════════

class SchemaGenerator extends FileGenerator {
  constructor(
    engine: TemplateEngine,
    projectRoot: string,
    private readonly force: boolean = false
  ) {
    super(engine, projectRoot);
  }

  getTemplateName() { return "schema.ts"; }
  
  resolveTargetPath(_vars: Record<string, any>) {
    return path.resolve(this.projectRoot, "src/db/schema/schema.ts");
  }

  override async generate(vars: Record<string, any>, fields: Field[]): Promise<string> {
    const { tableName } = vars;
    const schemaDir = path.resolve(this.projectRoot, "src/db/schema");
    await fs.mkdir(schemaDir, { recursive: true });

    const fullPath = this.resolveTargetPath(vars);
    const columnLines = this.buildColumnLines(fields);
    const content = await this.engine.render(this.getTemplateName(), { 
      tableName, 
      columns: columnLines 
    });

    try {
      const existing = await fs.readFile(fullPath, "utf-8");
      if (!existing.includes(`export const ${tableName}`)) {
        await fs.appendFile(fullPath, `\n${content}\n`);
      } else if (this.force) {
        consola.info(`Overwriting existing schema for ${tableName}`);
        const regex = new RegExp(
          `export const ${tableName} = sqliteTable\\('${tableName}', [\\s\\S]*?\\);`,
          "g"
        );
        await fs.writeFile(fullPath, existing.replace(regex, content));
      }
    } catch {
      const importsTpl = await this.engine.load("schema_imports.ts");
      const imports = TemplateEngine.renderString(importsTpl, {});
      await fs.writeFile(fullPath, imports + "\n" + content);
    }

    return fullPath;
  }

  private buildColumnLines(fields: Field[]): string {
    return fields
      .filter((f) => !f.relationship)
      .map((field) => {
        let drizzleType = field.type;
        if (drizzleType === "string") drizzleType = "text";
        if (drizzleType === "boolean") drizzleType = "integer";

        let line = `  ${field.name}: ${drizzleType}('${field.name}')`;
        if (field.options.notNull) line += ".notNull()";
        if (field.options.primaryKey) line += ".primaryKey()";
        if (field.options.autoincrement) line += ".autoincrement()";
        if (field.options.default !== undefined) {
          const val = isNaN(Number(field.options.default))
            ? `sql\`'${field.options.default}'\``
            : field.options.default;
          line += `.default(${val})`;
        }
        return line + ",";
      })
      .join("\n");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES GENERATOR (Special Generator)
//
// Handles two distinct but related scenarios:
//   1. `--all` mode: accumulates route data across all migrations, then writes
//      a fresh routes.ts from a template in one shot.
//   2. Single mode: patches an existing routes.ts by inserting new route lines
//      into the appropriate namespaced blocks.
// ═════════════════════════════════════════════════════════════════════════════

class RoutesGenerator {
  private controllerImports: string[] = [];
  private controllerRpcImports: string[] = [];
  private controllerRpcViewImports: string[] = [];
  private d1ResourceRoutes: string[] = [];
  private d1RpcRoutes: string[] = [];
  private doRpcViewRoutes: string[] = [];

  constructor(
    private readonly engine: TemplateEngine,
    private readonly projectRoot: string
  ) {}

  get routesPath(): string {
    return path.join(this.projectRoot, "src/routes.ts");
  }

  /** Accumulate route registrations for a single migration (used in --all mode) */
  addMigration(migration: ParsedMigration, typeName: string, pluralTypeName: string): void {
    this.controllerImports.push(pluralTypeName);
    this.controllerRpcImports.push(`${pluralTypeName}Rpc`);

    if (migration.location === "d1") {
      this.d1ResourceRoutes.push(
        `      v1.resources('${migration.tableName}', ${pluralTypeName}Controller, { rpc: ${pluralTypeName}Rpc });`
      );
      this.d1RpcRoutes.push(
        `        rpc.post('/${migration.tableName}', ${pluralTypeName}RpcController.action('rpc'));`
      );
    }

    if (migration.location === "do") {
      this.controllerRpcViewImports.push(`${pluralTypeName}Rpc`);
      this.doRpcViewRoutes.push(
        `        views.post('/${migration.tableName}', ${pluralTypeName}RpcController.action('rpc'));`
      );
    }
  }

  /** Write a fresh routes.ts from the template (used in --all mode) */
  async generateRoutesFile(): Promise<string> {
    const controllerImportLines = this.controllerImports
      .map((name) => `  ${name}Controller,`)
      .join("\n");
    const controllerRpcImportLines = this.controllerRpcImports
      .map((name) => `  ${name}RpcController,`)
      .join("\n");
    const controllerRpcViewImportLines = this.controllerRpcViewImports
      .map((name) => `  ${name}RpcController,`)
      .join("\n");

    const content = await this.engine.render("routes.ts", {
      controllerImports: controllerImportLines,
      controllerRpcImports: controllerRpcImportLines,
      controllerRpcViewImports: controllerRpcViewImportLines,
      d1ResourceRoutes: this.d1ResourceRoutes.join("\n"),
      d1RpcRoutes: this.d1RpcRoutes.join("\n"),
      doRpcViewRoutes: this.doRpcViewRoutes.join("\n"),
    });

    await fs.writeFile(this.routesPath, content);
    return this.routesPath;
  }

  /** Also generate the types/index.ts barrel (companion to routes in --all mode) */
  async generateTypesIndex(typeExports: string[]): Promise<string> {
    const indexPath = path.join(this.projectRoot, "src/models/types", "index.ts");
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    const content = await this.engine.render("types_index.ts", {
      typeExports: typeExports.join("\n"),
    });
    await fs.writeFile(indexPath, content);
    return indexPath;
  }

  /** Patch an existing routes.ts with a new single resource (single mode) */
  async updateRoutes(tableName: string, pluralTypeName: string, isDurableObject: boolean): Promise<void> {
    try {
      let content = await fs.readFile(this.routesPath, "utf-8");

      if (
        content.includes(`v1.resources('${tableName}'`) ||
        content.includes(`v1.resources("${tableName}"`)
      ) {
        consola.info(`Route for ${tableName} already exists`);
        return;
      }

      if (isDurableObject) {
        const viewRegistration = `        views.post('/${tableName}', ${pluralTypeName}RpcController.action('rpc'));`;
        const viewsMatch = content.match(
          /v1\.namespace\('rpc\/views',\s*\(views:\s*AppRoutes\)\s*=>\s*\{/
        );
        if (viewsMatch) {
          const index = viewsMatch.index! + viewsMatch[0].length;
          content = content.slice(0, index) + "\n" + viewRegistration + content.slice(index);
          await fs.writeFile(this.routesPath, content);
          consola.success(`Updated routes.ts with DO view route for ${tableName}`);
        } else {
          consola.warn(`Could not find rpc/views namespace in routes.ts. Add manually:`);
          consola.log(viewRegistration);
        }
      } else {
        const resourceRegistration = `      v1.resources('${tableName}', ${pluralTypeName}Controller, { rpc: ${pluralTypeName}Rpc });`;
        const rpcRegistration = `        rpc.post('/${tableName}', ${pluralTypeName}RpcController.action('rpc'));`;

        const v1Match = content.match(/this\.version\('1',\s*\(v1:\s*AppRoutes\)\s*=>\s*\{/);
        if (v1Match) {
          const index = v1Match.index! + v1Match[0].length;
          content = content.slice(0, index) + "\n" + resourceRegistration + content.slice(index);
          await fs.writeFile(this.routesPath, content);
          consola.success(`Updated routes.ts with resource route for ${tableName}`);
        } else {
          consola.warn(`Could not find v1 definition in routes.ts. Add manually:`);
          consola.log(resourceRegistration);
        }

        const rpcMatch = content.match(/v1\.namespace\('rpc',\s*\(rpc:\s*AppRoutes\)\s*=>\s*\{/);
        if (rpcMatch) {
          const index = rpcMatch.index! + rpcMatch[0].length;
          content = content.slice(0, index) + "\n" + rpcRegistration + content.slice(index);
          await fs.writeFile(this.routesPath, content);
          consola.success(`Updated routes.ts with RPC route for ${tableName}`);
        }
      }
    } catch {
      consola.warn(`routes.ts not found. Skipping automatic update.`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MIGRATION PARSER
// ═════════════════════════════════════════════════════════════════════════════

class MigrationParser {
  static async parse(filePath: string): Promise<ParsedMigrationFile> {
    const content = await fs.readFile(filePath, "utf-8");
    const fileName = path.basename(filePath, ".ts");

    const classNameMatch = content.match(/export\s+default\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : pascalCase(fileName);

    const tableNameMatches = content.matchAll(/this\.(?:create|up)Table\(['"]([^'"]+)['"]/g);
    const tableNames = Array.from(tableNameMatches, (m) => m[1]);

    if (tableNames.length === 0) {
      throw new Error(`Could not find any table names in migration: ${filePath}`);
    }

    const locationMatch = content.match(/location:\s*['"]([^'"]+)['"]/);
    const defaultLocation = locationMatch ? locationMatch[1] : "d1";

    const migrations: ParsedMigration[] = [];

    for (const tableName of tableNames) {
      const tableBlockMatch = content.match(
        new RegExp(`this\\.(?:create|up)Table\\(['"]${tableName}['"][\\s\\S]*?(?=\\n\\s*(?:await\\s+)?this\\.|(?:async\\s+)?change\\(\\)|$)`, "i")
      );

      let tableContent = content;
      if (tableBlockMatch) {
        tableContent = tableBlockMatch[0];
      }

      const tableLocationMatch = tableContent.match(/location:\s*['"]([^'"]+)['"]/);
      const location = tableLocationMatch ? tableLocationMatch[1] : defaultLocation;

      const doMatch = content.match(/readonly\s+durableObjectClass\s*=\s*['"]([^'"]+)['"]/);
      const durableObjectClass = doMatch ? doMatch[1] : undefined;

      const doTypeMatch = content.match(/t\.doType\(['"]([^'"]+)['"]/);
      const doType = doTypeMatch ? doTypeMatch[1] : undefined;

      const populateMatch = content.match(/t\.populateFrom\(([^)]+)\)/);
      const populateFrom: string[] = [];
      if (populateMatch) {
        const args = populateMatch[1].match(/['"]([^'"]+)['"]/g);
        if (args) populateFrom.push(...args.map((a) => a.replace(/['"]/g, "")));
      }

      const doModelMatch = content.match(/t\.doModel\(['"]([^'"]+)['"]/);
      const doModel = doModelMatch ? doModelMatch[1] : undefined;

      const fields: Field[] = [];
      const foreignKeys: ParsedMigration["foreignKeys"] = [];
      const indexes: ParsedMigration["indexes"] = [];

      const fieldRegex = /t\.(\w+)\(['"]([^'"]+)['"]\s*(?:,\s*(\{[^}]+\}))?\);/g;
      let match;
      while ((match = fieldRegex.exec(tableContent)) !== null) {
        const originalType = match[1];
        const name = match[2];
        const optsRaw = match[3] || "";
        const options: Record<string, any> = {};

        let type = originalType;
        if (type === "text") type = "string";
        if (type === "timestamp") type = "string";
        if (type === "datetime") type = "string";
        if (type === "id") type = "integer";

        if (optsRaw.includes("notNull: true")) options.notNull = true;
        if (optsRaw.includes("unique: true")) options.unique = true;
        if (optsRaw.includes("index: true")) options.index = true;
        if (optsRaw.includes("primaryKey: true")) options.primaryKey = true;
        if (optsRaw.includes("autoincrement: true")) options.autoincrement = true;
        const defaultMatch = optsRaw.match(/default:\s*([^,}]+)/);
        if (defaultMatch) options.default = defaultMatch[1].trim();

        fields.push({ name, type, options });
      }

      const fkRegex =
        /t\.foreignKey\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"](?:\s*,\s*(\{[^}]+\}))?\);/g;
      while ((match = fkRegex.exec(tableContent)) !== null) {
        const fk: any = { column: match[1], toTable: match[2], toColumn: match[3] };
        const onDeleteMatch = (match[4] || "").match(/onDelete:\s*['"]([^'"]+)['"]/);
        if (onDeleteMatch) fk.onDelete = onDeleteMatch[1];
        foreignKeys.push(fk);
      }

      const indexRegex = /t\.index\(([^)]+)\);/g;
      while ((match = indexRegex.exec(tableContent)) !== null) {
        const cols = match[1].match(/['"]([^'"]+)['"]/g);
        if (cols) indexes.push({ columns: cols.map((c) => c.replace(/['"]/g, "")) });
      }

      const relRegex = /t\.(belongsTo|hasMany|hasOne)\(['"]([^'"]+)['"]\s*,\s*(\{[^}]+\})\);/g;
      while ((match = relRegex.exec(tableContent)) !== null) {
        const relType = match[1] as "hasMany" | "belongsTo" | "hasOne";
        const target = match[2];
        const optsRaw = match[3];
        const nameMatch = optsRaw.match(/name:\s*['"]([^'"]+)['"]/);
        const fkMatch = optsRaw.match(/foreignKey:\s*['"]([^'"]+)['"]/);
        fields.push({
          name: nameMatch ? nameMatch[1] : target,
          type: "relationship",
          options: {},
          relationship: {
            type: relType,
            target,
            foreignKey: fkMatch ? fkMatch[1] : undefined,
            name: nameMatch ? nameMatch[1] : undefined,
          },
        });
      }

      migrations.push({
        tableName,
        className,
        fields,
        location: location as "d1" | "do",
        durableObjectClass,
        doType,
        populateFrom,
        doModel,
        foreignKeys,
        indexes,
        filePath,
      });
    }

    return {
      filePath,
      className,
      migrations,
    };
  }

  static async parseAll(migrationsDir: string): Promise<ParsedMigration[]> {
    if (!(await fs.stat(migrationsDir).catch(() => null))) return [];
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".ts")).sort();
    const results: ParsedMigration[] = [];
    for (const file of files) {
      try {
        const parsed = await MigrationParser.parse(path.join(migrationsDir, file));
        results.push(...parsed.migrations);
      } catch (e) {
        consola.warn(`Skipping ${file}: ${e}`);
      }
    }
    return results;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SCAFFOLD DIRECTOR (Orchestrator)
//
// Orchestrates the full scaffold pipeline for both --all and single modes.
// It owns the migration resolution logic, wires the builder + factory +
// generators together, and handles the "run migrations" side-effect.
// ═════════════════════════════════════════════════════════════════════════════

interface ScaffoldOptions {
  force: boolean;
  skipMigrate: boolean;
  projectRoot: string;
  migrationsDir: string;
}

class ScaffoldDirector {
  private readonly routesGen: RoutesGenerator;
  private readonly schemaGen: SchemaGenerator;

  constructor(
    private readonly engine: TemplateEngine,
    private readonly options: ScaffoldOptions
  ) {
    this.routesGen = new RoutesGenerator(engine, options.projectRoot);
    this.schemaGen = new SchemaGenerator(engine, options.projectRoot, options.force);
  }

  // ── Single Resource ──────────────────────────────────────────────────────

  async scaffoldSingle(migrationFile?: string): Promise<void> {
    const filePath = await this.resolveMigrationFile(migrationFile);

    consola.start(`Parsing migration: ${path.basename(filePath)}...`);
    const parsedFile = await MigrationParser.parse(filePath);

    for (const parsed of parsedFile.migrations) {
      const typeName = typeNameFromTableName(parsed.tableName);
      const modelFileName = snakeCase(typeName);
      const pluralTypeName = pluralize(typeName);

      consola.success(
        `Target: ${typeName} (Table: ${parsed.tableName}, Location: ${parsed.location})`
      );
      consola.info(`Output Root: ${this.options.projectRoot}`);

      const vars = new TemplateVarsBuilder()
        .withMigration(parsed, typeName, modelFileName)
        .withFormFields(parsed.fields)
        .build();

      await this.schemaGen.generate(vars, parsed.fields);
      consola.success(`Schema: ${parsed.tableName}`);

      const generated = await this.generateForMigration(parsed, vars);

      for (const stub of generated) {
        consola.success(`Generated: ${path.relative(this.options.projectRoot, stub)}`);
      }

      await this.routesGen.updateRoutes(parsed.tableName, pluralTypeName, parsed.location === "do");
    }

    this.runMigrations();
    consola.success(`\nScaffold complete for ${parsedFile.className}!`);
  }

  // ── Full Project ─────────────────────────────────────────────────────────

  async scaffoldAll(): Promise<void> {
    const { migrationsDir, projectRoot } = this.options;
    consola.start(`Parsing all migrations in ${migrationsDir}...`);

    const migrations = await MigrationParser.parseAll(migrationsDir);
    if (migrations.length === 0) {
      consola.error("No migration files found");
      process.exit(1);
    }

    consola.success(`Found ${migrations.length} migration(s)`);

    const d1 = migrations.filter((m) => m.location === "d1");
    const doMigs = migrations.filter((m) => m.location === "do");
    consola.info(`D1 tables: ${d1.map((m) => m.tableName).join(", ")}`);
    if (doMigs.length > 0) {
      consola.info(`DO tables: ${doMigs.map((m) => m.tableName).join(", ")}`);
    }

    await this.ensureDirectories();
    consola.start("Generating full project scaffold...");

    const typeExports: string[] = [];

    for (const migration of migrations) {
      const typeName = typeNameFromTableName(migration.tableName);
      const modelFileName = snakeCase(typeName);

      const vars = new TemplateVarsBuilder()
        .withMigration(migration, typeName, modelFileName)
        .withFormFields(migration.fields)
        .build();

      consola.start(`Generating ${typeName}...`);

      await this.schemaGen.generate(vars, migration.fields);
      await this.generateForMigration(migration, vars);

      typeExports.push(`export * from './${modelFileName}';`);
      this.routesGen.addMigration(migration, typeName, vars.pluralTypeName);

      consola.success(`Generated ${typeName}`);
    }

    await this.routesGen.generateTypesIndex(typeExports);
    await this.routesGen.generateRoutesFile();

    consola.success("\nFull project scaffold complete!");
    consola.info(`Generated ${migrations.length} resource(s) across D1 and Durable Objects`);

    this.runMigrations();
  }

  // ── Shared Helpers ───────────────────────────────────────────────────────

  private async generateForMigration(
    migration: ParsedMigration,
    vars: Record<string, any>
  ): Promise<string[]> {
    const { engine, options } = this;
    const generated: string[] = [];

    const standardGenerators = FileGeneratorFactory.createStandard(engine, options.projectRoot);
    for (const gen of standardGenerators) {
      generated.push(await gen.generate(vars, migration.fields));
    }

    if (migration.location === "do") {
      const typeName = vars.typeName as string;
      const doClassName = migration.durableObjectClass || `${typeName}DurableObject`;
      const doVars = new TemplateVarsBuilder()
        .withExtra(vars)
        .withDurableObject(doClassName, migration.doType || "view", migration.populateFrom)
        .build();

      const doGenerators = FileGeneratorFactory.createDurableObjectExtras(
        engine,
        options.projectRoot
      );
      for (const gen of doGenerators) {
        generated.push(await gen.generate(doVars, migration.fields));
      }
      consola.success(`Generated DO: ${doClassName}`);
    }

    return generated;
  }

  private async resolveMigrationFile(migrationFile?: string): Promise<string> {
    const { migrationsDir } = this.options;

    if (!migrationFile) {
      if (!(await fs.stat(migrationsDir).catch(() => null))) {
        consola.error(`Migrations directory not found: ${migrationsDir}`);
        process.exit(1);
      }
      const files = await fs.readdir(migrationsDir);
      const latest = files.filter((f) => f.endsWith(".ts")).sort().pop();
      if (!latest) {
        consola.error(`No migration files found in ${migrationsDir}`);
        process.exit(1);
      }
      return path.join(migrationsDir, latest);
    }

    const cwdPath = path.resolve(process.cwd(), migrationFile);
    const migrationsPath = path.resolve(migrationsDir, migrationFile);

    if (await fs.stat(cwdPath).catch(() => null)) return cwdPath;
    if (await fs.stat(migrationsPath).catch(() => null)) return migrationsPath;

    if (!migrationFile.endsWith(".ts")) {
      const files = await fs.readdir(migrationsDir);
      const match = files.find((f) => f.includes(migrationFile));
      if (match) return path.join(migrationsDir, match);
    }

    consola.error(`Migration not found: ${migrationFile}`);
    process.exit(1);
  }

  private async ensureDirectories(): Promise<void> {
    const { projectRoot } = this.options;
    const dirs = [
      "src/models/types",
      "src/controllers/rpcs",
      "src/controllers/rpcs/views",
      "src/services",
      "src/rpc",
      "src/rpc/instances",
      "src/views",
      "src/durable_objects",
      "public/components",
    ];
    await Promise.all(
      dirs.map((d) => fs.mkdir(path.join(projectRoot, d), { recursive: true }))
    );
  }

  private runMigrations(): void {
    if (this.options.skipMigrate) return;
    consola.start("Running db:migrate:full...");
    spawnSync("pnpm", ["db:migrate:full"], {
      stdio: "inherit",
      cwd: this.options.projectRoot,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════

export const scaffoldCommand = defineCommand({
  meta: {
    name: "scaffold",
    description: "Generate scaffold files from migration files",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to migration file (optional, defaults to latest)",
      required: false,
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Generate the entire project from all migrations",
      default: false,
    },
    template: {
      type: "string",
      alias: "t",
      description: "Remote template or local directory path",
    },
    force: {
      type: "boolean",
      alias: "f",
      description: "Force overwrite existing files",
      default: false,
    },
    skipMigrate: {
      type: "boolean",
      description: "Skip running db:migrate:full after generation",
      default: false,
    },
    out: {
      type: "string",
      description: "Target output directory (defaults to current project root)",
    },
    src: {
      type: "string",
      description: "Source directory override (where migrations are found)",
    },
  },
  async run({ args }) {
    const projectRoot = (args.out as string) || process.cwd();
    const srcRoot = (args.src as string) || process.cwd();
    const migrationsDir = path.resolve(srcRoot, "src/db/migrate");

    // Resolve template engine via Adapter pattern
    let engine: TemplateEngine;
    if (args.template) {
      const templateValue = args.template as string;
      const isRemote = templateValue.startsWith("gh:") || templateValue.startsWith("http://") || templateValue.startsWith("https://") || templateValue.startsWith("gitlab:");
      if (isRemote) {
        consola.info(`Fetching remote template: ${templateValue}`);
        engine = TemplateEngine.fromRemoteUrl(templateValue);
      } else {
        engine = TemplateEngine.fromLocalDir(path.resolve(process.cwd(), templateValue));
      }
    } else {
      engine = TemplateEngine.fromLocalDir(path.resolve(__dirname, "../../templates/scaffold"));
    }

    const director = new ScaffoldDirector(engine, {
      force: args.force as boolean,
      skipMigrate: args.skipMigrate as boolean,
      projectRoot,
      migrationsDir,
    });

    if (args.all) {
      await director.scaffoldAll();
    } else {
      await director.scaffoldSingle(args.file as string | undefined);
    }
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API — Backwards-Compatible Exports
//
// These thin wrappers preserve the external API surface so that any code
// depending on `generateSchema` or `generateFromTemplate` continues to compile.
// ═════════════════════════════════════════════════════════════════════════════

export async function generateSchema(
  tableName: string,
  fields: Field[],
  options: { force?: boolean; projectRoot?: string },
  loadTemplate: (n: string) => Promise<string>
): Promise<string> {
  const projectRoot = options.projectRoot || process.cwd();
  const loader: ITemplateLoader = { load: loadTemplate };
  const engine = new TemplateEngine(loader);
  const gen = new SchemaGenerator(engine, projectRoot, options.force ?? false);
  return gen.generate({ tableName }, fields);
}

export async function generateFromTemplate(
  name: string,
  targetPath: string,
  vars: any,
  fields: Field[],
  loadTemplate: (n: string) => Promise<string>
): Promise<string> {
  const loader: ITemplateLoader = { load: loadTemplate };
  const engine = new TemplateEngine(loader);

  // Use an anonymous inline generator so the logic matches FileGenerator.generate()
  const gen = new (class extends FileGenerator {
    getTemplateName() { return name; }
    resolveTargetPath() { return targetPath; }
  })(engine, path.dirname(targetPath));

  return gen.generate(vars, fields);
}

// ═════════════════════════════════════════════════════════════════════════════
// TYPES INDEX GENERATOR (Special Generator)
//
// Writes the barrel re-export index.ts for the models/types directory.
// ═════════════════════════════════════════════════════════════════════════════

class TypesIndexGenerator {
  constructor(
    private readonly engine: TemplateEngine,
    private readonly projectRoot: string
  ) {}

  async generate(typeExports: string[]): Promise<string> {
    const indexPath = path.join(this.projectRoot, "src/models/types", "index.ts");
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    const content = await this.engine.render("types_index.ts", {
      typeExports: typeExports.join("\n"),
    });
    await fs.writeFile(indexPath, content);
    return indexPath;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

function modelNameFromTableName(tableName: string): string {
  return _singularize(tableName);
}

function typeNameFromTableName(tableName: string): string {
  return classify(tableName);
}

/**
 * Parse a field token string of the form `name:type:modifier:key=value` into
 * a `Field` object. Used by the CLI's field-definition shorthand syntax.
 *
 * Examples:
 *   "title:string:notNull:unique"
 *   "price:decimal:precision=10:scale=2:default=0"
 *   "owner_id:text:references=users:onDelete=cascade"
 *   ":hasMany=comments"
 */
export function parseField(token: string): Field {
  const parts = token.split(":");
  const name = parts[0] ?? "";
  const typeRaw = parts[1] ?? "string";
  const modifiers = parts.slice(2);

  const options: Record<string, any> = {};

  // Relationship shorthand: ":hasMany=target" / ":belongsTo=target" etc.
  const relMatch = typeRaw.match(/^(hasMany|belongsTo|hasOne)=(.+)$/);
  if (relMatch) {
    return {
      name,
      type: typeRaw,
      options,
      relationship: { 
        type: relMatch[1] as "hasMany" | "belongsTo" | "hasOne", 
        target: relMatch[2] 
      },
    };
  }

  for (const mod of modifiers) {
    if (mod === "notNull") { options.notNull = true; continue; }
    if (mod === "unique") { options.unique = true; continue; }
    if (mod === "index") { options.index = true; continue; }
    if (mod === "primaryKey") { options.primaryKey = true; continue; }
    if (mod === "autoincrement") { options.autoincrement = true; continue; }

    const [key, val] = mod.split("=");
    if (val !== undefined) {
      const num = Number(val);
      if (key === "default" || val === "") {
        options[key] = val;
      } else {
        options[key] = isNaN(num) ? val : num;
      }
    }
  }

  return { name, type: typeRaw, options };
}

export const pluralize = _pluralize;
