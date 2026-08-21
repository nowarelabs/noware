/**
 * Agent hooks — the Flue-inspired DSL for agent composition.
 *
 * These hooks populate a per-invocation context. The `defineAgent` function
 * creates the context, runs the agent function (which calls hooks), and
 * extracts the results.
 *
 * Convention: agent files live at `src/agents/<name>.ts` and export a
 * `defineAgent(...)` call or a class extending `Agent`.
 */

import type {
  AgentDefinition,
  DataWriterDefinition,
  DeliveredMessage,
  LifecycleHooks,
  ModelOptions,
  PersistentStateDefinition,
  SandboxFactory,
  SkillDefinition,
  SubagentDefinition,
  ToolDefinition,
  ToolInput,
  ToolOutput,
} from "./types.js";

// ----------------------------------------------------------------
// Hook context — per-invocation state
// ----------------------------------------------------------------

export interface HookContext {
  model?: string;
  modelOptions?: ModelOptions;
  instructions: string;
  tools: ToolDefinition[];
  skills: SkillDefinition[];
  subagents: SubagentDefinition[];
  persistentState: PersistentStateDefinition[];
  dataWriters: DataWriterDefinition[];
  sandbox?: SandboxFactory;
  lifecycle: LifecycleHooks;
}

let currentContext: HookContext | undefined;

export function getCurrentContext(): HookContext {
  if (!currentContext) {
    throw new Error("Hook called outside of agent definition context");
  }
  return currentContext;
}

export function runWithHooks<T>(ctx: HookContext, fn: () => T): T {
  const prev = currentContext;
  currentContext = ctx;
  try {
    return fn();
  } finally {
    currentContext = prev;
  }
}

function createContext(): HookContext {
  return {
    instructions: "",
    tools: [],
    skills: [],
    subagents: [],
    persistentState: [],
    dataWriters: [],
    lifecycle: {},
  };
}

// ----------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------

/**
 * Selects the LLM model for this agent.
 *
 * ```ts
 * useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
 *   thinkingLevel: 'medium',
 * });
 * ```
 */
export function useModel(model: string, opts?: ModelOptions): void {
  const ctx = getCurrentContext();
  ctx.model = model;
  if (opts) ctx.modelOptions = opts;
}

/**
 * Adds a static instruction block to the agent's system prompt.
 */
export function useInstruction(text: string): void {
  const ctx = getCurrentContext();
  ctx.instructions += (ctx.instructions ? "\n" : "") + text;
}

/**
 * Mounts a tool on the agent.
 */
export function useTool<
  TInput extends ToolInput = ToolInput,
  TOutput extends ToolOutput = ToolOutput,
>(tool: ToolDefinition<TInput, TOutput>): void {
  const ctx = getCurrentContext();
  ctx.tools.push(tool as unknown as ToolDefinition<ToolInput, ToolOutput>);
}

/**
 * Loads a skill into the agent's catalog.
 */
export function useSkill(skill: SkillDefinition): void {
  const ctx = getCurrentContext();
  ctx.skills.push(skill);
}

/**
 * Registers a named subagent delegate.
 */
export function useSubagent(
  name: string,
  description: string,
  agent: AgentDefinition | (() => AgentDefinition),
): void {
  const ctx = getCurrentContext();
  ctx.subagents.push({ name, description, agent });
}

/**
 * Provides durable state that persists across turns.
 * Returns a [value, setter] tuple (React-like useState pattern).
 *
 * Note: In the hook definition context, this registers the state key.
 * The actual state management happens at runtime in the DO.
 */
export function usePersistentState<T>(
  _key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const ctx = getCurrentContext();
  ctx.persistentState.push({ key: _key, defaultValue });
  // Return a no-op setter for the definition context.
  // The real setter is provided at runtime by the DO.
  return [defaultValue, () => {}];
}

/**
 * Returns a writer function that emits named, schema-validated data parts
 * into the conversation stream.
 */
export function useDataWriter(
  name: string,
  opts?: { schema?: unknown },
): (data: unknown) => void {
  const ctx = getCurrentContext();
  ctx.dataWriters.push({ name, schema: opts?.schema });
  // Return a no-op writer for the definition context.
  return () => {};
}

/**
 * Returns the current message being processed.
 */
export function useDelivery(): DeliveredMessage {
  // In the definition context, return a placeholder.
  // The real delivery is provided at runtime.
  return { kind: "unknown", type: "unknown", body: null };
}

/**
 * Returns the creation-time data payload.
 */
export function useInitialData<T>(): T | undefined {
  return undefined;
}

/**
 * Lifecycle hook: runs at the beginning of an agent turn.
 */
export function useAgentStart(
  fn: (ctx: {
    log: {
      info: typeof console.log;
      warn: typeof console.warn;
      error: typeof console.error;
    };
  }) => void,
): void {
  const ctx = getCurrentContext();
  ctx.lifecycle.agentStart = fn as LifecycleHooks["agentStart"];
}

/**
 * Lifecycle hook: runs after the agent turn completes.
 */
export function useAgentFinish(
  fn: (ctx: {
    log: {
      info: typeof console.log;
      warn: typeof console.warn;
      error: typeof console.error;
    };
    response: unknown;
  }) => void,
): void {
  const ctx = getCurrentContext();
  ctx.lifecycle.agentFinish = fn as LifecycleHooks["agentFinish"];
}

/**
 * Lifecycle hook: runs when a model response begins streaming.
 */
export function useResponseStart(fn: () => Record<string, unknown>): void {
  const ctx = getCurrentContext();
  ctx.lifecycle.responseStart = fn;
}

/**
 * Lifecycle hook: runs after a model response is complete.
 */
export function useResponseFinish(
  fn: (ctx: {
    metadata: Record<string, unknown>;
    response: unknown;
  }) => Record<string, unknown>,
): void {
  const ctx = getCurrentContext();
  ctx.lifecycle.responseFinish = fn;
}

/**
 * Attaches a filesystem + shell execution environment to the agent.
 */
export function useSandbox(factory: SandboxFactory): void {
  const ctx = getCurrentContext();
  ctx.sandbox = factory;
}

// ----------------------------------------------------------------
// Bash sandbox helper
// ----------------------------------------------------------------

/**
 * Creates a bash sandbox factory.
 *
 * ```ts
 * useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));
 * ```
 */
export function bash(create: () => unknown): SandboxFactory {
  return { type: "bash", create };
}

/**
 * A general-purpose subagent that can be used as a delegate.
 */
export const GeneralSubagent: AgentDefinition = {
  name: "general",
  className: "NowarelabsGeneralAgent",
  instructions: "",
  tools: [],
  skills: [],
  subagents: [],
  persistentState: [],
  dataWriters: [],
  lifecycle: {},
};

// ----------------------------------------------------------------
// Provider registration
// ----------------------------------------------------------------

const providers = new Map<string, unknown>();

/**
 * Registers a custom model provider globally.
 */
export function setProvider(provider: unknown): void {
  const p = provider as { id?: string };
  if (p.id) providers.set(p.id, provider);
}

/**
 * Gets a registered provider by ID.
 */
export function getProvider(id: string): unknown {
  return providers.get(id);
}

export { createContext };
