/**
 * Interface for tracking task progress
 */
export interface TaskProgress {
  current: number;
  total?: number;
  status: "pending" | "running" | "completed" | "failed" | "interrupted";
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base class for all maintenance tasks
 */
export abstract class MaintenanceTask<TParams = Record<string, unknown>> {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Run the task logic
   * @param params Parameters for the task
   * @param onProgress Callback to report progress
   */
  abstract run(
    params: TParams,
    onProgress: (progress: TaskProgress) => void | Promise<void>,
  ): Promise<void>;

  /**
   * Optional method to resume a task from a specific progress state
   */
  async resume(
    params: TParams,
    progress: TaskProgress,
    onProgress: (progress: TaskProgress) => void | Promise<void>,
  ): Promise<void> {
    return this.run(params, onProgress);
  }
}

/**
 * Registry for maintenance tasks
 */
export class TaskRegistry {
  private tasks = new Map<string, MaintenanceTask>();

  register(task: MaintenanceTask) {
    this.tasks.set(task.name, task);
  }

  getTask(name: string): MaintenanceTask | undefined {
    return this.tasks.get(name);
  }

  listTasks(): MaintenanceTask[] {
    return Array.from(this.tasks.values());
  }
}

/**
 * Global registry instance
 */
export const registry = new TaskRegistry();
