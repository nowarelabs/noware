import { type Result, ok } from "nomo/result";
import {
  Dialect,
  Statement,
  DialectStrategy,
  getDialectStrategy,
} from "nomo/sql";
import { HandlerFunc, STANDARD_HANDLERS } from "./handlers";

/**
 * Generates SQL for migration commands.
 * Delegating all logic to DialectStrategy (Strategy Pattern)
 * and functional handlers (Registry Pattern).
 */
export class SqlGenerator {
  private handlers: Map<string, HandlerFunc> = new Map();
  public strategy: DialectStrategy;

  constructor(dialect: Dialect = "sqlite") {
    this.strategy = getDialectStrategy(dialect);
    this.registerDefaultHandlers();
  }

  /**
   * Register a custom command handler.
   */
  registerHandler(type: string, handler: HandlerFunc) {
    this.handlers.set(type, handler);
  }

  /**
   * Register or override a type mapping.
   */
  registerType(type: string, dbType: string) {
    if ("registerType" in this.strategy) {
      (this.strategy as any).registerType(type, dbType);
    }
  }

  generate(action: any): Result<string> {
    const res = this.generateStatement(action);
    if (!res.success) return res as Result<never>;
    const statement = res.data;
    if (!statement) return ok("");

    return statement.toSql(this.strategy).transform((output) => {
      let sql = output.value;
      if (!sql.endsWith(";")) {
        sql += ";";
      }
      return sql;
    });
  }

  generateStatement(action: any): Result<Statement | null> {
    const { type } = action;
    const handler = this.handlers.get(type);

    if (!handler) {
      console.warn(
        `SQL generation for ${type} not implemented (no handler registered).`,
      );
      return ok(null);
    }

    return handler(action, this.strategy);
  }

  private registerDefaultHandlers() {
    for (const [type, handler] of Object.entries(STANDARD_HANDLERS)) {
      this.registerHandler(type, handler);
    }
  }
}
