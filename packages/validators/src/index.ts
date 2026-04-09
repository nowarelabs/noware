import { z } from "zod";

export abstract class BaseValidator<T = any> {
  protected abstract schema: z.ZodType<T>;

  constructor(protected data: any) {}

  validate(): T {
    return this.schema.parse(this.data);
  }

  safeValidate() {
    return this.schema.safeParse(this.data);
  }

  static validate<V extends BaseValidator>(this: new (data: any) => V, data: any) {
    return new this(data).validate();
  }
}
