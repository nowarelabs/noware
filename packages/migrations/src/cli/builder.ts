/**
 * Fluent interface for building source code files from templates
 */
export class CodeBuilder {
  private content: string[] = [];

  /**
   * Append raw text to the builder
   */
  append(text: string): this {
    this.content.push(text);
    return this;
  }

  /**
   * Append a newline
   */
  nl(): this {
    this.content.push("\n");
    return this;
  }

  /**
   * Render a template with variable replacement
   * Syntax: {{variable}}
   */
  render(template: string, vars: Record<string, any>): this {
    let rendered = template;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      rendered = rendered.replace(regex, String(value));
    }
    this.content.push(rendered);
    return this;
  }

  /**
   * Clear the builder
   */
  clear(): this {
    this.content = [];
    return this;
  }

  /**
   * Finalize the built code
   */
  toString(): string {
    return this.content.join("");
  }
}
