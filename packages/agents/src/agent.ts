/**
 * Agent definition — the `defineAgent` function and convention helpers.
 *
 * Convention (Rails-style):
 * - Agent files: `src/agents/<name>.ts`
 * - Tool files: `src/tools/<name>.ts`
 * - Skill files: `src/skills/<name>/SKILL.md`
 * - DO class name: `Nowarelabs<PascalCase>Agent` (auto from agent name)
 * - URL routing: `/agents/<name>/<conversationId>`
 * - Service bindings: `<NAME>_AGENT` env var (auto from agent name)
 */

import type { AgentDefinition } from "./types.js";
import { createContext, runWithHooks, type HookContext } from "./hooks.js";

// ----------------------------------------------------------------
// Convention helpers
// ----------------------------------------------------------------

/**
 * Converts an agent name to PascalCase for class naming.
 * `'coding'` → `'Coding'`, `'code-review'` → `'CodeReview'`
 */
export function pascalCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/**
 * Converts an agent name to SCREAMING_SNAKE_CASE for env var naming.
 * `'coding'` → `'CODING'`, `'code-review'` → `'CODE_REVIEW'`
 */
export function screamingSnakeCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((word) => word.toUpperCase())
    .join("_");
}

/**
 * Generates the DO class name from an agent name.
 * `'coding'` → `'NowarelabsCodingAgent'`
 */
export function agentClassName(name: string): string {
  return `Nowarelabs${pascalCase(name)}Agent`;
}

/**
 * Generates the env var name for a service binding.
 * `'coding'` → `'CODING_AGENT'`
 */
export function agentBindingName(name: string): string {
  return `${screamingSnakeCase(name)}_AGENT`;
}

/**
 * Generates the URL mount path for an agent.
 * `'coding'` → `'/agents/coding'`
 */
export function agentMountPath(name: string): string {
  return `/agents/${name}`;
}

// ----------------------------------------------------------------
// defineAgent — hook pattern
// ----------------------------------------------------------------

/**
 * Defines an agent using the hooks DSL.
 *
 * ```ts
 * export default defineAgent('coding', () => {
 *   useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct');
 *   useTool(githubTool);
 *   useInstruction('You are the Coding agent...');
 *   return {};
 * });
 * ```
 */
export function defineAgent(
  name: string,
  fn: () => void,
  overrides?: Partial<
    Pick<AgentDefinition, "className" | "model" | "modelOptions">
  >,
): AgentDefinition {
  const ctx = createContext();

  runWithHooks(ctx, fn);

  const className = overrides?.className ?? agentClassName(name);

  return Object.freeze({
    name,
    className,
    model: overrides?.model ?? ctx.model,
    modelOptions: overrides?.modelOptions ?? ctx.modelOptions,
    instructions: ctx.instructions,
    tools: ctx.tools,
    skills: ctx.skills,
    subagents: ctx.subagents,
    persistentState: ctx.persistentState,
    dataWriters: ctx.dataWriters,
    sandbox: ctx.sandbox,
    lifecycle: ctx.lifecycle,
  });
}

/**
 * Extracts a HookContext from an AgentDefinition (for runtime use).
 */
export function extractContext(def: AgentDefinition): HookContext {
  return {
    model: def.model,
    modelOptions: def.modelOptions,
    instructions: def.instructions,
    tools: def.tools,
    skills: def.skills,
    subagents: def.subagents,
    persistentState: def.persistentState,
    dataWriters: def.dataWriters,
    sandbox: def.sandbox,
    lifecycle: def.lifecycle,
  };
}
