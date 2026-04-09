import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";

import { DurableObjectBaseDelegate } from "./delegate";
import { PopulateDelegate, PopulateConfig } from "./delegates/populate";
import { ViewDelegate, ViewConfig } from "./delegates/view";
import { CheckDelegate, CheckConfig } from "./delegates/check";
import { QueueDelegate, QueueConfig } from "./delegates/queue";
import { ExecutionDelegate, ExecutionConfig } from "./delegates/execution";
import { SearchDelegate, SearchConfig } from "./delegates/search";
import { LockDelegate, LockConfig } from "./delegates/lock";
import { LogDelegate, LogConfig } from "./delegates/log";
import { LogicDelegate, LogicConfig } from "./delegates/logic";
import { ConfigDelegate, ConfigOptions } from "./delegates/config";

export class BaseDurableObject extends DurableObject {
  storage: DurableObjectStorage;
  db: DrizzleSqliteDODatabase<any>;
  protected delegates: Map<string, DurableObjectBaseDelegate> = new Map();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.storage = ctx.storage;
    // @ts-ignore - Drizzle typed for DO storage
    this.db = drizzle(this.storage, { logger: false });
  }

  /**
   * Register a delegate for a specific pattern.
   * If the delegate defines a name, it will be attached to the DO instance for RPC.
   */
  protected use<T extends DurableObjectBaseDelegate>(
    name: string,
    delegateClass: new (owner: BaseDurableObject, config: any) => T,
    config: any,
  ): T {
    const delegate = new delegateClass(this, config);
    this.delegates.set(name, delegate);

    // Bind the handle method to this[name] for RPC accessibility
    (this as any)[name] = (...args: any[]) => delegate.handle(...args);

    // Call onInit if it exists
    if (delegate.onInit) {
      delegate.onInit();
    }

    return delegate;
  }

  protected is_view(config: ViewConfig) {
    return this.use("view", ViewDelegate, config);
  }

  protected can_populate(config: PopulateConfig) {
    return this.use("populate", PopulateDelegate, config);
  }

  protected is_queue(config: QueueConfig) {
    return this.use("queue", QueueDelegate, config);
  }

  protected is_check(config: CheckConfig) {
    return this.use("check", CheckDelegate, config);
  }

  protected is_sequential(config: ExecutionConfig) {
    return this.use("sequential", ExecutionDelegate, { ...config, mode: "sequential" });
  }

  protected is_parallel(config: ExecutionConfig) {
    return this.use("parallel", ExecutionDelegate, { ...config, mode: "parallel" });
  }

  protected is_search(config: SearchConfig) {
    return this.use("search", SearchDelegate, config);
  }

  protected is_lock(config: LockConfig) {
    return this.use("lock", LockDelegate, config);
  }

  protected is_event_log(config: LogConfig) {
    return this.use("event_log", LogDelegate, config);
  }

  protected is_calculate(config: LogicConfig) {
    return this.use("calculate", LogicDelegate, config);
  }

  protected is_trigger(config: LogicConfig) {
    return this.use("trigger", LogicDelegate, config);
  }

  protected is_auto_log(config: LogConfig) {
    return this.use("auto_log", LogDelegate, { ...config, autoLog: true });
  }

  protected is_adapter(config: ConfigOptions) {
    return this.use("adapter", ConfigDelegate, config);
  }

  protected is_furnish(config: ConfigOptions) {
    return this.use("furnish", ConfigDelegate, config);
  }

  protected is_decision_matrix(config: LogicConfig) {
    return this.use("decision_matrix", LogicDelegate, config);
  }

  protected is_configure(config: ConfigOptions) {
    return this.use("configure", ConfigDelegate, config);
  }

  protected is_paginate(config: SearchConfig) {
    return this.use("paginate", SearchDelegate, config);
  }

  async execSql(sqlText: string) {
    return await this.storage.sql.exec(sqlText).toArray();
  }

  async clear(table: any): Promise<void> {
    await this.storage.sql.exec(`DELETE FROM ${table?.name || table}`);
  }

  async insertBatch<T extends Record<string, any>>(table: any, records: T[]): Promise<number> {
    if (!records?.length) return 0;

    const tableName = table?.name || table;
    const columns = Object.keys(records[0]);
    const placeholders = records
      .map((_, i) => `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(", ")})`)
      .join(", ");

    const values = records.flatMap((r) => columns.map((c) => r[c]));

    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${placeholders}`;
    await this.storage.sql.exec(sql, values);

    return records.length;
  }
}
