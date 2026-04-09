import { BaseDurableObject } from "./index";

export abstract class DurableObjectBaseDelegate<Config = any> {
  constructor(
    protected durableObject: BaseDurableObject,
    protected config: Config,
  ) {}

  /**
   * Optional initialization hook called after the delegate is registered
   */
  async onInit?(): Promise<void>;

  /**
   * Optional fetch hook to handle specific requests
   */
  async onFetch?(request: Request): Promise<Response | undefined>;

  /**
   * The primary method associated with the pattern (e.g., populate, check, etc.)
   */
  abstract handle(...args: any[]): Promise<any>;
}
