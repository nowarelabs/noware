import { DurableObjectBaseDelegate } from "../delegate";

export interface QueueConfig<T = any> {
  name: string;
  onProcess: (owner: any, item: T) => Promise<void>;
  maxRetries?: number;
}

export class QueueDelegate<T = any> extends DurableObjectBaseDelegate<QueueConfig<T>> {
  /**
   * Enqueue an item
   */
  async handle(item: T): Promise<{ status: string; id: string }> {
    const id = crypto.randomUUID();
    // Use the DO's SQL to store queue items
    await this.durableObject.storage.sql.exec(
      `INSERT INTO queue_${this.config.name} (id, payload, status, retries, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, JSON.stringify(item), "pending", 0, Date.now()],
    );
    return { status: "enqueued", id };
  }

  /**
   * Process the next items in the queue
   */
  async process(batchSize: number = 10): Promise<number> {
    const { onProcess, maxRetries = 3, name } = this.config;

    // Simple FIFO processing
    const results = await this.durableObject.storage.sql
      .exec(
        `SELECT * FROM queue_${name} WHERE status = 'pending' OR (status = 'failed' AND retries < ?) 
       ORDER BY created_at ASC LIMIT ?`,
        [maxRetries, batchSize],
      )
      .toArray();

    if (results.length === 0) return 0;

    for (const row of results) {
      const item = JSON.parse(row.payload as string);
      try {
        await onProcess(this.durableObject, item);
        await this.durableObject.storage.sql.exec(`DELETE FROM queue_${name} WHERE id = ?`, [
          row.id,
        ]);
      } catch (_e) {
        await this.durableObject.storage.sql.exec(
          `UPDATE queue_${name} SET status = 'failed', retries = retries + 1 WHERE id = ?`,
          [row.id],
        );
      }
    }

    return results.length;
  }
}
