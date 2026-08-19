/**
 * @nowarelabs/agents — multi-agent orchestration with Rails-style conventions.
 *
 * This package provides:
 *
 * 1. **Infrastructure** — crash-safe leases, heartbeats, task queues,
 *    sessions, and reconciliation. The "software factory" layer.
 *
 * 2. **Agent DSL** — Flue-inspired hooks (`useModel`, `useTool`, etc.)
 *    with Rails-style conventions (convention over configuration).
 *    Both hook pattern and class pattern are supported.
 *
 * 3. **Cloudflare integration** — adapters for Cloudflare's `agents`
 *    package, DO class generation, and service binding resolution.
 *
 * ## Conventions (Rails-style)
 *
 * - Agent files: `src/agents/<name>.ts`
 * - Tool files: `src/tools/<name>.ts`
 * - Skill files: `src/skills/<name>/SKILL.md`
 * - DO class name: `Nomo<PascalCase>Agent` (auto from agent name)
 * - URL routing: `/agents/<name>/<conversationId>`
 * - Service bindings: `<NAME>_AGENT` env var (auto from agent name)
 *
 * ## Hook pattern (simple agents)
 *
 * ```ts
 * import { defineAgent, useModel, useTool } from '@nowarelabs/agents';
 *
 * export default defineAgent('coding', () => {
 *   useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct');
 *   useTool(githubTool);
 *   useInstruction('You are the Coding agent...');
 * });
 * ```
 *
 * ## Class pattern (complex agents)
 *
 * ```ts
 * import { Agent, defineTool } from '@nowarelabs/agents';
 *
 * export class CodingAgent extends Agent {
 *   model = 'cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct';
 *   tools = [githubTool];
 * }
 * ```
 */

// ----------------------------------------------------------------
// Infrastructure (existing — crash-safe leases, heartbeats, tasks)
// ----------------------------------------------------------------

export type {
  Clock,
  WorkspaceDoClient,
  AgentSession,
  CreateSessionOpts,
  HeartbeatLoop,
  Task,
  TaskStatus,
  TaskQueue,
  ReconcileResult,
  RunAgentOpts,
  AgentTaskHandler,
} from "./infrastructure.js";

export {
  createWallClock,
  createSession,
  acquireLease,
  releaseLease,
  createHeartbeatLoop,
  createMemoryQueue,
  reconcile,
  runAgent,
} from "./infrastructure.js";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type {
  ToolDefinition,
  ToolInput,
  ToolOutput,
  ToolLogger,
  SkillDefinition,
  AgentDefinition,
  ModelOptions,
  SubagentDefinition,
  PersistentStateDefinition,
  DataWriterDefinition,
  SandboxFactory,
  LifecycleHooks,
  LifecycleContext,
  DeliveredMessage,
  AgentClassDefinition,
  AgentInstance,
} from "./types.js";

// ----------------------------------------------------------------
// Agent DSL — hooks
// ----------------------------------------------------------------

export {
  useModel,
  useInstruction,
  useTool,
  useSkill,
  useSubagent,
  usePersistentState,
  useDataWriter,
  useDelivery,
  useInitialData,
  useAgentStart,
  useAgentFinish,
  useResponseStart,
  useResponseFinish,
  useSandbox,
  bash,
  GeneralSubagent,
  setProvider,
  getProvider,
} from "./hooks.js";

// ----------------------------------------------------------------
// Agent DSL — definition
// ----------------------------------------------------------------

export {
  defineAgent,
  pascalCase,
  screamingSnakeCase,
  agentClassName,
  agentBindingName,
  agentMountPath,
  extractContext,
} from "./agent.js";

// ----------------------------------------------------------------
// Tool definition
// ----------------------------------------------------------------

export { defineTool, consoleLogger } from "./tools.js";

// ----------------------------------------------------------------
// Skill definition
// ----------------------------------------------------------------

export { defineSkill, parseSkillMarkdown } from "./skills.js";

// ----------------------------------------------------------------
// Router
// ----------------------------------------------------------------

export { createAgentRouter } from "./router.js";
export type { AgentRouterOptions, HonoRoute, HonoHandler } from "./router.js";

// ----------------------------------------------------------------
// Cloudflare adapters
// ----------------------------------------------------------------

export { executeTool, buildSystemPrompt, prepareForCloudflare } from "./cloudflare.js";
export type { CloudflareAgentLike, GeneratedAgentClass } from "./cloudflare.js";
