import { DurableObjectBaseDelegate } from "../delegate";

export interface LogConfig {
  tableName?: string;
  autoLog?: boolean;
}

export class LogDelegate extends DurableObjectBaseDelegate<LogConfig> {
  /**
   * Log an event to the DO's SQL storage.
   */
  async handle(event: string, metadata: any = {}): Promise<void> {
    const { tableName = "logs" } = this.config;

    await this.durableObject.storage.sql.exec(
      `INSERT INTO ${tableName} (event, metadata, created_at) VALUES (?, ?, ?)`,
      [event, JSON.stringify(metadata), Date.now()],
    );
  }

  /**
   * Auto-log logic (can be hooked into onInit or other lifecycle methods)
   */
  async autoLog(message: string, level: "info" | "error" = "info"): Promise<void> {
    if (!this.config.autoLog) return;
    await this.handle(level === "error" ? "auto_error" : "auto_info", { message });
  }
}
