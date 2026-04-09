import { DurableObjectBaseDelegate } from "../delegate";

export interface LogicConfig {
  onCalculate?: (owner: any, input: any) => Promise<any>;
  onTrigger?: (owner: any, event: any) => Promise<void>;
  onDecision?: (owner: any, matrix: any) => Promise<any>;
}

export class LogicDelegate extends DurableObjectBaseDelegate<LogicConfig> {
  /**
   * Perform calculation logic
   */
  async handle(input: any): Promise<any> {
    const { onCalculate } = this.config;
    if (onCalculate) {
      return await onCalculate(this.durableObject, input);
    }
    return input;
  }

  /**
   * Handle triggers from external events
   */
  async trigger(event: any): Promise<void> {
    const { onTrigger } = this.config;
    if (onTrigger) {
      await onTrigger(this.durableObject, event);
    }
  }

  /**
   * Evaluate a decision matrix
   */
  async decide(matrix: any): Promise<any> {
    const { onDecision } = this.config;
    if (onDecision) {
      return await onDecision(this.durableObject, matrix);
    }
    return matrix;
  }
}
