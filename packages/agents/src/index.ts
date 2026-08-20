/**
 * @nowarelabs/agents — agent DSL with Rails-style conventions.
 *
 * This package provides the declarative agent definition layer:
 * hooks, tools, skills, and routing.
 *
 * Infrastructure (sessions, leases, heartbeats, Cloudflare integration)
 * lives in `@nowarelabs/agent-runtime`.
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
export type { AgentRouterOptions, AgentRoute } from "./router.js";
