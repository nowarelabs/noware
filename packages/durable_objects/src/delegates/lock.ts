import { DurableObjectBaseDelegate } from "../delegate";

export interface LockConfig {
  type: "status" | "callback";
  onTimeout?: (owner: any) => Promise<void>;
  timeoutMs?: number;
}

export class LockDelegate extends DurableObjectBaseDelegate<LockConfig> {
  /**
   * Acquire a lock for the specified operation
   */
  async handle(id: string): Promise<{ success: boolean; lockId?: string }> {
    const { type, timeoutMs = 30000 } = this.config;
    const expiresAt = Date.now() + timeoutMs;

    // Check if lock exists and hasn't expired
    const existing = await this.durableObject.storage.sql
      .exec(`SELECT * FROM locks WHERE id = ? AND type = ? AND expires_at > ?`, [
        id,
        type,
        Date.now(),
      ])
      .toArray();

    if (existing.length > 0) {
      return { success: false };
    }

    // Acquire lock
    await this.durableObject.storage.sql.exec(
      `INSERT OR REPLACE INTO locks (id, type, expires_at) VALUES (?, ?, ?)`,
      [id, type, expiresAt],
    );

    return { success: true, lockId: id };
  }

  /**
   * Release a lock
   */
  async release(id: string): Promise<void> {
    const { type } = this.config;
    await this.durableObject.storage.sql.exec(`DELETE FROM locks WHERE id = ? AND type = ?`, [
      id,
      type,
    ]);
  }

  /**
   * Refresh a lock
   */
  async refresh(id: string): Promise<boolean> {
    const { type, timeoutMs = 30000 } = this.config;
    const expiresAt = Date.now() + timeoutMs;

    await this.durableObject.storage.sql
      .exec(`UPDATE locks SET expires_at = ? WHERE id = ? AND type = ?`, [expiresAt, id, type])
      .toArray();

    return true; // Simple update for now
  }
}
