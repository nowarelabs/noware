/**
 * Shared types for the agent DSL.
 */

// ----------------------------------------------------------------
// Tool definition
// ----------------------------------------------------------------

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  [key: string]: unknown;
}

export interface ToolDefinition<
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
  run: (ctx: { data: TInput; log: ToolLogger }) => Promise<TOutput>;
}

export interface ToolLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

// ----------------------------------------------------------------
// Skill definition
// ----------------------------------------------------------------

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
  files?: Record<string, string>;
}

// ----------------------------------------------------------------
// Agent definition
// ----------------------------------------------------------------

export interface AgentDefinition {
  name: string;
  className: string;
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

export interface ModelOptions {
  thinkingLevel?: "low" | "medium" | "high";
  compaction?: {
    keepRecentTokens?: number;
  };
}

export interface SubagentDefinition {
  name: string;
  description: string;
  agent: AgentDefinition | (() => AgentDefinition);
}

export interface PersistentStateDefinition {
  key: string;
  defaultValue: unknown;
}

export interface DataWriterDefinition {
  name: string;
  schema?: unknown;
}

export interface SandboxFactory {
  type: "bash" | "remote";
  create: () => unknown;
}

// ----------------------------------------------------------------
// Lifecycle hooks
// ----------------------------------------------------------------

export interface LifecycleHooks {
  agentStart?: (ctx: LifecycleContext) => Promise<void> | void;
  agentFinish?: (ctx: LifecycleContext & { response: unknown }) => Promise<void> | void;
  responseStart?: () => Record<string, unknown>;
  responseFinish?: (ctx: {
    metadata: Record<string, unknown>;
    response: unknown;
  }) => Record<string, unknown>;
}

export interface LifecycleContext {
  log: ToolLogger;
}

// ----------------------------------------------------------------
// Delivery (current message)
// ----------------------------------------------------------------

export interface DeliveredMessage {
  kind: string;
  type: string;
  body: unknown;
  attributes?: Record<string, string>;
}

// ----------------------------------------------------------------
// Agent class pattern
// ----------------------------------------------------------------

export interface AgentClassDefinition {
  new (...args: unknown[]): AgentInstance;
  className: string;
  agentName: string;
}

export interface AgentInstance {
  model?: string;
  modelOptions?: ModelOptions;
  tools?: ToolDefinition[];
  skills?: SkillDefinition[];
  subagents?: SubagentDefinition[];
  sandbox?: SandboxFactory;
  onStart?(): Promise<void> | void;
  onFinish?(): Promise<void> | void;
  onMessage?(message: DeliveredMessage): Promise<void> | void;
}
