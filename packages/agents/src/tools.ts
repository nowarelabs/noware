/**
 * Tool definition helper — the `defineTool` function.
 *
 * Convention: tool files live at `src/tools/<name>.ts` and export a single
 * `defineTool(...)` call. The tool name defaults to the filename slug.
 */

import type { ToolDefinition, ToolInput, ToolOutput, ToolLogger } from "./types.js";

// ----------------------------------------------------------------
// Default logger (console-based, Workers-safe)
// ----------------------------------------------------------------

const consoleLogger: ToolLogger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[info] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[warn] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[error] ${msg}`, ...args),
};

// ----------------------------------------------------------------
// Identity parser (pass-through, no validation)
// ----------------------------------------------------------------

function identityParse<T>(raw: unknown): T {
  return raw as T;
}

// ----------------------------------------------------------------
// defineTool
// ----------------------------------------------------------------

export interface DefineToolOpts<
  TInput extends ToolInput = ToolInput,
  TOutput extends ToolOutput = ToolOutput,
> {
  name: string;
  description: string;
  input?: {
    parse: (raw: unknown) => TInput;
  };
  output?: {
    parse: (raw: unknown) => TOutput;
  };
  durable?: boolean;
  harness?: boolean;
  run: (ctx: { data: TInput; log: ToolLogger; step?: StepHandle }) => Promise<TOutput>;
}

export interface StepHandle {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Defines a tool. The returned object is frozen and can be mounted on an
 * agent via `useTool()` or the `tools` array in a class-based agent.
 *
 * ```ts
 * export const githubTool = defineTool({
 *   name: 'github_tool',
 *   description: 'Call GitHub API methods',
 *   input: { parse: (raw) => raw as GithubInput },
 *   async run({ data, log }) {
 *     return { result: await callGithub(data) };
 *   },
 * });
 * ```
 */
export function defineTool<
  TInput extends ToolInput = ToolInput,
  TOutput extends ToolOutput = ToolOutput,
>(opts: DefineToolOpts<TInput, TOutput>): ToolDefinition<TInput, TOutput> {
  const tool: ToolDefinition<TInput, TOutput> = {
    name: opts.name,
    description: opts.description,
    input: opts.input ?? { parse: identityParse },
    output: opts.output ?? { parse: identityParse },
    durable: opts.durable,
    harness: opts.harness,
    run: opts.run,
  };
  return Object.freeze(tool);
}

export { consoleLogger };
