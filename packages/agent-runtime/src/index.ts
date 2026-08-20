/**
 * @nowarelabs/agent-runtime — agent runtime infrastructure.
 *
 * This package provides the "software factory" layer: sessions, leases,
 * heartbeats, task queues, reconciliation, and Cloudflare integration.
 *
 * Split from `@nowarelabs/agents` (which now contains only the DSL).
 *
 * ## Data flow (unidirectional)
 *
 * ```
 * Feature → AgentRuntime → UseCase → Port → Gateway → Model
 * ```
 *
 * The runtime sits between the feature layer (lifecycle orchestration)
 * and the use case layer (individual tool operations).
 */

// ----------------------------------------------------------------
// Infrastructure — crash-safe leases, heartbeats, tasks
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
// Cloudflare adapters — DO class generation, tool dispatch
// ----------------------------------------------------------------

export { executeTool, buildSystemPrompt, prepareForCloudflare } from "./cloudflare.js";
export type { CloudflareAgentLike, GeneratedAgentClass } from "./cloudflare.js";
