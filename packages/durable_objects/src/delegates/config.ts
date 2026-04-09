import { DurableObjectBaseDelegate } from "../delegate";

export interface ConfigEntry<T = any> {
  key: string;
  value: T;
}

export interface ConfigOptions {
  onConfigure?: (owner: any, config: any) => Promise<void>;
  onAdapter?: (owner: any, input: any) => Promise<any>;
  onFurnish?: (owner: any, output: any) => Promise<any>;
}

export class ConfigDelegate extends DurableObjectBaseDelegate<ConfigOptions> {
  /**
   * Configure the Durable Object with settings.
   */
  async handle(settings: any): Promise<void> {
    const { onConfigure } = this.config;
    if (onConfigure) {
      await onConfigure(this.durableObject, settings);
    }
  }

  /**
   * Adapt data from one form to another.
   */
  async adapt(input: any): Promise<any> {
    const { onAdapter } = this.config;
    if (onAdapter) {
      return await onAdapter(this.durableObject, input);
    }
    return input;
  }

  /**
   * Furnish the output data.
   */
  async furnish(output: any): Promise<any> {
    const { onFurnish } = this.config;
    if (onFurnish) {
      return await onFurnish(this.durableObject, output);
    }
    return output;
  }
}
