import { DurableObjectBaseDelegate } from "../delegate";

export interface CheckConfig {
  validator: (owner: any, data: any) => Promise<{ success: boolean; errors?: string[] }>;
}

export class CheckDelegate extends DurableObjectBaseDelegate<CheckConfig> {
  /**
   * Run the validation logic
   */
  async handle(data: any): Promise<{ success: boolean; errors?: string[] }> {
    const { validator } = this.config;
    try {
      return await validator(this.durableObject, data);
    } catch (e: any) {
      return { success: false, errors: [e.message] };
    }
  }
}
