import type { ContextLike, RequestLike, EnvLike, EntrypointContext } from "@nowarelabs/contexts";
import { createContext } from "@nowarelabs/contexts";

export type {
  Body,
  RequestLike,
  EnvLike,
  ContextLike,
  RouterContext,
  ControllerContext,
  ServiceContext,
  ModelContext,
  ViewContext,
  EntrypointContext,
  FeatureContext,
  AdapterRequest,
  AdapterResponse,
  AdapterContext,
  ModuleContext,
  RpcContext,
  IntegrationEventContext,
  UseCaseContext,
  PortContext,
  AggregateContext,
  EventContext,
  QueryContext,
  GatewayContext,
  PersistenceContext,
  SqlContext,
  MigrationContext,
  LoggerContext,
  JobContext,
  AssetContext,
  DurableObjectContext,
  CfourContext,
  DtoContext,
  NormalizerContext,
  ValidatorContext,
  FormatterContext,
  SerializerContext,
  MaintenanceContext,
  PluginContext,
  ScriptContext,
  DomainContext,
} from "@nowarelabs/contexts";

export {
  createContext,
  createContextWith,
  createRouterContext,
  createControllerContext,
  createServiceContext,
  createModelContext,
  createViewContext,
  enhanceRouterContext,
  enhanceControllerContext,
  enhanceServiceContext,
  enhanceModelContext,
  enhanceViewContext,
} from "@nowarelabs/contexts";

export interface RouterLike<
  Req = RequestLike,
  Env extends EnvLike = EnvLike,
  Ctx extends ContextLike = ContextLike,
  TOutput = Response,
> {
  handle(request: Req, env: Env, ctx: Ctx): Promise<TOutput>;
}

export interface ControllerLike {
  run(action: string, ...args: any[]): Promise<Response>;
}

export interface MessageHandlerLike<
  TBody = unknown,
  TMetadata = Record<string, unknown>,
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  handle(body: TBody, metadata: TMetadata, env: TEnv, ctx: TCtx): Promise<void>;
}

export interface DurableObjectHandlerLike<
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  fetch(request: Request, env: TEnv, ctx: TCtx): Promise<Response>;
  alarm(env: TEnv, ctx: TCtx): Promise<void>;
}

export interface GrpcHandlerLike<
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  unary(request: Uint8Array, env: TEnv, ctx: TCtx): Promise<Uint8Array>;
  serverStream(request: Uint8Array, env: TEnv, ctx: TCtx): AsyncIterable<Uint8Array>;
  clientStream(requests: AsyncIterable<Uint8Array>, env: TEnv, ctx: TCtx): Promise<Uint8Array>;
  bidiStream(requests: AsyncIterable<Uint8Array>, env: TEnv, ctx: TCtx): AsyncIterable<Uint8Array>;
}

export interface WorkflowStep {
  do<T>(name: string, fn: (ctx: { state: { finished: boolean } }) => Promise<T>): Promise<T>;
  sleep(name: string, duration: string): Promise<void>;
  sleepUntil(name: string, timestamp: Date | number): Promise<void>;
}

export interface WorkflowHandlerLike<
  TPayload = unknown,
  TResult = unknown,
  TEnv extends EnvLike = EnvLike,
  TCtx extends EntrypointContext = EntrypointContext,
> {
  run(payload: TPayload, step: WorkflowStep, env: TEnv, ctx: TCtx): Promise<TResult>;
}

export type UseCaseResult<TOutput, TError = Error> =
  | { success: true; data: TOutput; status: "delivered" }
  | { success: false; error: TError; status: "abandoned" };

export interface HookOptions {
  only?: string[];
  except?: string[];
}

export interface Port<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<UseCaseResult<TOutput>>;
}

export type HookFunction<T = any, R = any> = (instance: T) => R | Promise<R> | void | Promise<void>;

export type AfterHookFunction<T = any, R = any> = (
  instance: T,
  result: R,
) => R | Promise<R> | void | Promise<void>;

export type AroundHookFunction<T = any, R = any> = (
  instance: T,
  next: () => Promise<R>,
) => Promise<R>;

export interface RegisteredHook<T = any, R = any> {
  fn: HookFunction<T, R> | AfterHookFunction<T, R> | AroundHookFunction<T, R>;
  options?: HookOptions;
}

export async function runBeforeHooks<T, R = any>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R | null> {
  for (const { fn, options } of hooks) {
    if (shouldRun && !shouldRun(options)) continue;
    const result = await (fn as HookFunction<T, R>)(instance);
    if (result !== undefined && result !== null) return result as R;
  }
  return null;
}

export async function runAfterHooks<T, R>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  result: R,
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R> {
  let current = result;
  for (const { fn, options } of hooks) {
    if (shouldRun && !shouldRun(options)) continue;
    const hookResult = await (fn as AfterHookFunction<T, R>)(instance, current);
    if (hookResult !== undefined && hookResult !== null) current = hookResult as R;
  }
  return current;
}

export async function runAroundHooks<T, R>(
  instance: T,
  hooks: readonly RegisteredHook<T, R>[],
  action: () => Promise<R>,
  shouldRun?: (options?: HookOptions) => boolean,
): Promise<R> {
  const applicable = hooks.filter((h) => !shouldRun || shouldRun(h.options));
  if (applicable.length === 0) return action();
  let index = 0;
  const next = async (): Promise<R> => {
    if (index >= applicable.length) return action();
    const { fn } = applicable[index++];
    return (fn as AroundHookFunction<T, R>)(instance, next);
  };
  return next();
}

export function fromCloudflareRequest(request: {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly redirect: string;
  readonly signal: AbortSignal;
  readonly integrity: string;
  readonly keepalive: boolean;
  clone(): any;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  formData(): Promise<FormData>;
  json(): Promise<any>;
  text(): Promise<string>;
}): RequestLike {
  return request as unknown as RequestLike;
}

export function fromCloudflareContext(ctx: {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  readonly props: unknown;
}): ContextLike {
  return ctx as ContextLike;
}

export function fromCloudflareEnv<T extends Record<string, unknown>>(env: T): EnvLike {
  return env;
}

export function fromWebRequest(request: Request): RequestLike {
  return request as RequestLike;
}

export function fromWebContext(): ContextLike {
  return createContext();
}

export function fromWebEnv<T extends Record<string, unknown>>(env: T): EnvLike {
  return env;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found", details?: unknown) {
    super(message, 404, details);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request", details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", details?: unknown) {
    super(message, 403, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, 409, details);
  }
}

export class ValidationError extends HttpError {
  constructor(message = "Validation Error", details?: unknown) {
    super(message, 422, details);
  }
}

export function isValidPath(path: string): boolean {
  const normalized = path.normalize("NFC");
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code <= 31 || code === 127 || (code >= 128 && code <= 159)) {
      return false;
    }
  }
  const forbidden = "<>\"'`\\^|[]{}";
  for (let i = 0; i < normalized.length; i++) {
    if (forbidden.indexOf(normalized[i]) !== -1) {
      return false;
    }
  }
  return true;
}

export function splitPath(path: string, maxDepth = 32): string[] {
  const normalized = path.normalize("NFC");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length > maxDepth) {
    throw new Error(`Path depth exceeded limit (${maxDepth}).`);
  }
  return segments;
}

interface NodeIncomingMessage {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { encrypted?: boolean };
}

export function fromNodeIncomingMessage(
  nodeReq: NodeIncomingMessage,
  body?: Uint8Array,
): RequestLike {
  const protocol = (nodeReq.socket as { encrypted?: boolean } | undefined)?.encrypted
    ? "https"
    : "http";
  const host = Array.isArray(nodeReq.headers.host)
    ? nodeReq.headers.host[0]
    : (nodeReq.headers.host ?? "localhost");
  const url = `${protocol}://${host}${nodeReq.url ?? "/"}`;
  const method = nodeReq.method ?? "GET";

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? (body ?? null) : null,
  }) as RequestLike;
}

// ----------------------------------------------------------------
// Stigmergic Agent Architecture Types
// ----------------------------------------------------------------

export type OrchestratorLevel = "root" | "ss" | "container" | "component";

export interface OrchestratorState {
  id: string;
  level: OrchestratorLevel;
  elementId: string;
  parentId?: string;
  childOrchestratorIds: string[];
  currentModel: Record<string, unknown>;
  lastPheromoneCheck: number;
  diffsProcessed: CfourDiff[];
  createdAt: number;
  updatedAt: number;
}

export interface CfourDiff {
  id: string;
  level: "ss" | "container" | "component" | "code";
  elementId: string;
  changeType: "description" | "pattern" | "relationship" | "structure" | "add" | "remove";
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  sourceOrchestratorId: string;
}

export type AtomType = "function" | "method" | "statement";
export type AtomStatus = "idle" | "working" | "review" | "merged" | "conflict";

export interface AtomState {
  id: string;
  cfourElementId: string;
  atomType: AtomType;
  content: string;
  language: string;
  filePath: string;
  parentComponentId: string;
  relationships: string[];
  assignedPattern: string;
  status: AtomStatus;
  agentDoId: string;
  versions: AtomVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface AtomVersion {
  id: string;
  content: string;
  agentDoId: string;
  timestamp: number;
  pheromoneEvents: string[];
  cfourValidation: CfourValidationResult;
  patternCompliance: PatternComplianceResult;
}

export interface CfourValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PatternComplianceResult {
  compliant: boolean;
  violations: string[];
}

export type AgentStatus = "idle" | "reading" | "working" | "leaving-cue" | "waiting";

export interface AgentState {
  id: string;
  atomDoId: string;
  agentType: string;
  cfourContract: Record<string, unknown>;
  assignedPattern: string;
  neighborAtomIds: string[];
  status: AgentStatus;
  lastPheromoneCheck: number;
  actions: AgentAction[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentAction {
  id: string;
  type: "read-atom" | "read-neighbor" | "write-atom" | "leave-cue" | "read-pheromone";
  atomDoId?: string;
  timestamp: number;
  result: "success" | "failure" | "skipped";
  details?: string;
}

export type PheromoneEventType =
  | "atom-needs-work"
  | "atom-ready"
  | "atom-conflict"
  | "atom-merged"
  | "atom-deleted"
  | "pattern-changed"
  | "description-changed"
  | "relationship-changed";

export interface PheromoneEvent {
  id: string;
  type: PheromoneEventType;
  elementId: string;
  level: "ss" | "container" | "component" | "code";
  agentDoId?: string;
  timestamp: number;
  cfourDiff?: CfourDiff;
  metadata?: Record<string, unknown>;
  consumedBy: string[];
}

export type ClaimStatus = "active" | "released" | "expired" | "stolen";

export interface ClaimState {
  id: string;
  atomId: string;
  agentDoId: string;
  status: ClaimStatus;
  acquiredAt: number;
  expiresAt: number;
  releasedAt?: number;
  acquisitions: ClaimAcquisition[];
}

export interface ClaimAcquisition {
  agentDoId: string;
  acquiredAt: number;
  releasedAt?: number;
  reason?: string;
}

export type BranchStatus = "active" | "merged" | "abandoned";

export interface BranchState {
  id: string;
  atomId: string;
  agentDoId: string;
  content: string;
  baseVersionId: string;
  status: BranchStatus;
  createdAt: number;
  updatedAt: number;
  versions: BranchVersion[];
}

export interface BranchVersion {
  id: string;
  content: string;
  agentDoId: string;
  timestamp: number;
  cfourValidation: CfourValidationResult;
  patternCompliance: PatternComplianceResult;
}

export type MergeStatus = "pending" | "auto" | "manual" | "conflict" | "merged" | "rejected";

export interface MergeState {
  id: string;
  atomId: string;
  sourceBranchId: string;
  targetBranchId?: string;
  status: MergeStatus;
  createdAt: number;
  mergedAt?: number;
  conflicts?: MergeConflict[];
  resolution?: MergeResolution;
}

export interface MergeConflict {
  id: string;
  section: string;
  sourceValue: string;
  targetValue: string;
  agentDoId?: string;
}

export interface MergeResolution {
  strategy: "auto" | "manual" | "gate";
  resolvedBy: string;
  resolvedAt: number;
  details: string;
}

// Architectural patterns
export type ArchitecturalPattern = "mvc" | "clean" | "ddd" | "event-driven" | "onion";

// Coding patterns (Refactoring Guru)
export type CodingPattern =
  | "factory"
  | "abstract-factory"
  | "builder"
  | "prototype"
  | "singleton"
  | "adapter"
  | "bridge"
  | "composite"
  | "decorator"
  | "facade"
  | "proxy"
  | "chain-of-responsibility"
  | "command"
  | "iterator"
  | "mediator"
  | "observer"
  | "strategy";

export interface Bid {
  systemId: string;
  entityId: string;
  value: number;
  conditions: BidCondition[];
}

export interface BidCondition {
  component: string;
  field: string;
  operator: "==" | "!=" | "<" | ">" | "<=" | ">=";
  value: unknown;
}

export interface Capability {
  component: string;
  access:
    | "read"
    | "write"
    | "execute"
    | "read+write"
    | "read+execute"
    | "write+execute"
    | "read+write+execute";
}

export interface SystemDefinition {
  name: string;
  description: string;
  capabilities: Capability[];
  bids: Array<{ conditions: BidCondition[]; value: number }>;
}

export interface Invariant {
  id: string;
  expression: string;
  description: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ComponentDefinition {
  name: string;
  schema: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ComponentInstance {
  entityId: string;
  componentName: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
}
