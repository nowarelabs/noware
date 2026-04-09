import { DurableObjectBaseDelegate } from "../delegate";

export type ExecutionMode = "sequential" | "parallel" | "sequential_realtime" | "parallel_realtime";

export interface ExecutionConfig {
  mode: ExecutionMode;
  onItem?: (owner: any, item: any) => Promise<any>;
}

export class ExecutionDelegate extends DurableObjectBaseDelegate<ExecutionConfig> {
  /**
   * Execute a collection of tasks based on the configured mode
   */
  async handle(items: any[]): Promise<any[]> {
    const { mode, onItem } = this.config;
    if (!onItem) return items;

    if (mode.startsWith("sequential")) {
      const results = [];
      for (const item of items) {
        results.push(await onItem(this.durableObject, item));
      }
      return results;
    } else {
      // Parallel
      return await Promise.all(items.map((item) => onItem(this.durableObject, item)));
    }
  }
}
