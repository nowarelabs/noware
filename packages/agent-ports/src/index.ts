/**
 * @nowarelabs/agent-ports — shared port interfaces for agent tools and channels.
 *
 * Ports define WHAT the system can do (the contract).
 * Gateways define HOW (the implementation).
 *
 * This package contains all port interfaces that agent tools and channels
 * implement. It follows the ports-and-adapters (hexagonal) architecture.
 *
 * ## Convention
 *
 * Each tool gets a port interface:
 * ```typescript
 * interface IJiraLinearPort extends Port<JiraLinearInput, JiraLinearOutput> {}
 * ```
 *
 * Each channel gets a port interface:
 * ```typescript
 * interface ISlackChannelPort extends Port<SlackMessage, MessageReceipt> {}
 * ```
 *
 * ## Data flow (unidirectional)
 *
 * ```
 * UseCase → Port → Gateway → External
 * ```
 */

import type { UseCaseResult } from "@nowarelabs/shared";

// ----------------------------------------------------------------
// Base port interface
// ----------------------------------------------------------------

/**
 * A Port defines a contract for external integration.
 * Input goes in, UseCaseResult comes out.
 */
export interface Port<TInput, TOutput> {
  execute(input: TInput): Promise<UseCaseResult<TOutput>>;
}

// ----------------------------------------------------------------
// Tool ports — one per tool backend
// ----------------------------------------------------------------

export interface JiraLinearInput {
  method: "createIssue" | "updateIssue" | "getBacklog" | "prioritizeBacklog";
  args?: Record<string, unknown>;
}

export interface JiraLinearOutput {
  issue?: { id: string; key: string; url: string };
  issues?: Array<{ id: string; key: string; url: string }>;
  prioritized?: boolean;
}

export interface IJiraLinearPort extends Port<JiraLinearInput, JiraLinearOutput> {}

// ----------------------------------------------------------------

export interface DispatchAgentInput {
  agent: string;
  conversationId: string;
  task: string;
  stage?: string;
  attributes?: Record<string, string>;
}

export interface DispatchAgentOutput {
  streamUrl?: string;
  offset?: number;
  submissionId?: string;
  stage: string;
}

export interface IDispatchAgentPort extends Port<DispatchAgentInput, DispatchAgentOutput> {}

// ----------------------------------------------------------------

export interface TaskQueueInput {
  method: "enqueueTask" | "getTaskStatus" | "assignTask";
  args?: Record<string, unknown>;
}

export interface TaskQueueOutput {
  taskId?: string;
  status?: string;
  assigned?: boolean;
}

export interface ITaskQueuePort extends Port<TaskQueueInput, TaskQueueOutput> {}

// ----------------------------------------------------------------

export interface HitlInput {
  method: "create" | "pendingCount" | "resolve";
  conversationId?: string;
  question?: string;
  options?: string[];
  answer?: string;
  hitlId?: string;
}

export interface HitlOutput {
  hitlId?: string;
  count?: number;
  resolved?: boolean;
}

export interface IHitlPort extends Port<HitlInput, HitlOutput> {}

// ----------------------------------------------------------------

export interface CloudPricingInput {
  method: "estimateCost" | "compareInstanceTypes";
  args?: Record<string, unknown>;
}

export interface CloudPricingOutput {
  estimate?: { monthly: number; hourly: number; currency: string };
  comparison?: Array<{ type: string; monthly: number }>;
}

export interface ICloudPricingPort extends Port<CloudPricingInput, CloudPricingOutput> {}

// ----------------------------------------------------------------

export interface DiagrammingInput {
  method: "generateDiagram" | "exportDiagram";
  args?: Record<string, unknown>;
}

export interface DiagrammingOutput {
  diagramUrl?: string;
  svg?: string;
  mermaid?: string;
}

export interface IDiagrammingPort extends Port<DiagrammingInput, DiagrammingOutput> {}

// ----------------------------------------------------------------

export interface IacInput {
  method: "planTerraform" | "applyTerraform" | "getState";
  args?: Record<string, unknown>;
}

export interface IacOutput {
  plan?: { changes: Array<{ action: string; resource: string }> };
  applied?: boolean;
  state?: Record<string, unknown>;
}

export interface IIacPort extends Port<IacInput, IacOutput> {}

// ----------------------------------------------------------------

export interface GitHubInput {
  method: "createPullRequest" | "mergePullRequest" | "getPullRequest" | "listIssues";
  args?: Record<string, unknown>;
}

export interface GitHubOutput {
  pr?: { number: number; url: string; title: string };
  merged?: boolean;
  issues?: Array<{ number: number; title: string; url: string }>;
}

export interface IGitHubPort extends Port<GitHubInput, GitHubOutput> {}

// ----------------------------------------------------------------

export interface StaticAnalysisInput {
  method: "analyze" | "getResults";
  args?: Record<string, unknown>;
}

export interface StaticAnalysisOutput {
  issues?: Array<{ file: string; line: number; message: string; severity: string }>;
  score?: number;
}

export interface IStaticAnalysisPort extends Port<StaticAnalysisInput, StaticAnalysisOutput> {}

// ----------------------------------------------------------------

export interface CiStatusInput {
  method: "getStatus" | "triggerPipeline" | "getLogs";
  args?: Record<string, unknown>;
}

export interface CiStatusOutput {
  status?: string;
  pipelineId?: string;
  logs?: string;
}

export interface ICiStatusPort extends Port<CiStatusInput, CiStatusOutput> {}

// ----------------------------------------------------------------

export interface SecurityScanInput {
  method: "scan" | "getVulnerabilities";
  args?: Record<string, unknown>;
}

export interface SecurityScanOutput {
  vulnerabilities?: Array<{ id: string; severity: string; description: string }>;
  score?: number;
}

export interface ISecurityScanPort extends Port<SecurityScanInput, SecurityScanOutput> {}

// ----------------------------------------------------------------

export interface SupportTicketsInput {
  method: "getTickets" | "createBacklogItemFromTicket";
  args?: Record<string, unknown>;
}

export interface SupportTicketsOutput {
  tickets?: Array<{ id: string; subject: string; status: string }>;
  backlogItemId?: string;
}

export interface ISupportTicketsPort extends Port<SupportTicketsInput, SupportTicketsOutput> {}

// ----------------------------------------------------------------

export interface SentimentAnalysisInput {
  method: "analyzeSentiment" | "clusterFeedback";
  args?: Record<string, unknown>;
}

export interface SentimentAnalysisOutput {
  sentiment?: { score: number; label: string };
  clusters?: Array<{ theme: string; count: number; sentiment: string }>;
}

export interface ISentimentAnalysisPort extends Port<
  SentimentAnalysisInput,
  SentimentAnalysisOutput
> {}

// ----------------------------------------------------------------

export interface WebSearchInput {
  method: "search" | "fetchPage";
  args?: Record<string, unknown>;
}

export interface WebSearchOutput {
  results?: Array<{ title: string; url: string; snippet: string }>;
  content?: string;
}

export interface IWebSearchPort extends Port<WebSearchInput, WebSearchOutput> {}

// ----------------------------------------------------------------

export interface CoverageInput {
  method: "getCoverage" | "getTrend";
  args?: Record<string, unknown>;
}

export interface CoverageOutput {
  coverage?: { lines: number; branches: number; functions: number };
  trend?: Array<{ date: string; coverage: number }>;
}

export interface ICoveragePort extends Port<CoverageInput, CoverageOutput> {}

// ----------------------------------------------------------------

export interface TestRunnerInput {
  method: "runTests" | "getResults";
  args?: Record<string, unknown>;
}

export interface TestRunnerOutput {
  passed?: number;
  failed?: number;
  skipped?: number;
  results?: Array<{ name: string; status: string; duration: number }>;
}

export interface ITestRunnerPort extends Port<TestRunnerInput, TestRunnerOutput> {}

// ----------------------------------------------------------------

export interface LogAggregationInput {
  method: "queryLogs" | "getPatterns";
  args?: Record<string, unknown>;
}

export interface LogAggregationOutput {
  logs?: Array<{ timestamp: number; level: string; message: string }>;
  patterns?: Array<{ pattern: string; count: number }>;
}

export interface ILogAggregationPort extends Port<LogAggregationInput, LogAggregationOutput> {}

// ----------------------------------------------------------------

export interface MonitoringInput {
  method: "getMetrics" | "getAlerts";
  args?: Record<string, unknown>;
}

export interface MonitoringOutput {
  metrics?: Array<{ name: string; value: number; unit: string }>;
  alerts?: Array<{ id: string; severity: string; message: string }>;
}

export interface IMonitoringPort extends Port<MonitoringInput, MonitoringOutput> {}

// ----------------------------------------------------------------

export interface PagerDutyInput {
  method: "createIncident" | "getIncidents" | "resolveIncident";
  args?: Record<string, unknown>;
}

export interface PagerDutyOutput {
  incident?: { id: string; url: string; status: string };
  incidents?: Array<{ id: string; title: string; status: string }>;
  resolved?: boolean;
}

export interface IPagerDutyPort extends Port<PagerDutyInput, PagerDutyOutput> {}

// ----------------------------------------------------------------

export interface ImageGenInput {
  method: "generate" | "variation";
  args?: Record<string, unknown>;
}

export interface ImageGenOutput {
  imageUrl?: string;
  b64?: string;
}

export interface IImageGenPort extends Port<ImageGenInput, ImageGenOutput> {}

// ----------------------------------------------------------------

export interface FigmaInput {
  method: "getFile" | "getComponents" | "exportImages";
  args?: Record<string, unknown>;
}

export interface FigmaOutput {
  file?: Record<string, unknown>;
  components?: Array<{ name: string; id: string }>;
  images?: Array<{ name: string; url: string }>;
}

export interface IFigmaPort extends Port<FigmaInput, FigmaOutput> {}

// ----------------------------------------------------------------

export interface AccessibilityInput {
  method: "check" | "getReport";
  args?: Record<string, unknown>;
}

export interface AccessibilityOutput {
  issues?: Array<{ rule: string; severity: string; message: string; element: string }>;
  score?: number;
}

export interface IAccessibilityPort extends Port<AccessibilityInput, AccessibilityOutput> {}

// ----------------------------------------------------------------

export interface FeatureFlagsInput {
  method: "isEnabled" | "setFlag" | "getAllFlags";
  args?: Record<string, unknown>;
}

export interface FeatureFlagsOutput {
  enabled?: boolean;
  flags?: Array<{ name: string; enabled: boolean }>;
}

export interface IFeatureFlagsPort extends Port<FeatureFlagsInput, FeatureFlagsOutput> {}

// ----------------------------------------------------------------

export interface ChangelogInput {
  method: "generate" | "getEntries";
  args?: Record<string, unknown>;
}

export interface ChangelogOutput {
  changelog?: string;
  entries?: Array<{ version: string; changes: string[] }>;
}

export interface IChangelogPort extends Port<ChangelogInput, ChangelogOutput> {}

// ----------------------------------------------------------------

export interface DocsGeneratorInput {
  method: "generate" | "update";
  args?: Record<string, unknown>;
}

export interface DocsGeneratorOutput {
  docsUrl?: string;
  pages?: number;
}

export interface IDocsGeneratorPort extends Port<DocsGeneratorInput, DocsGeneratorOutput> {}

// ----------------------------------------------------------------

export interface SbomInput {
  method: "generate" | "getVulnerabilities";
  args?: Record<string, unknown>;
}

export interface SbomOutput {
  sbom?: Record<string, unknown>;
  vulnerabilities?: Array<{ id: string; severity: string; package: string }>;
}

export interface ISbomPort extends Port<SbomInput, SbomOutput> {}

// ----------------------------------------------------------------

export interface CicdPipelineInput {
  method: "createPipeline" | "getPipelineStatus" | "getLogs";
  args?: Record<string, unknown>;
}

export interface CicdPipelineOutput {
  pipelineId?: string;
  status?: string;
  logs?: string;
}

export interface ICicdPipelinePort extends Port<CicdPipelineInput, CicdPipelineOutput> {}

// ----------------------------------------------------------------

export interface PackageManagerInput {
  method: "install" | "update" | "audit";
  args?: Record<string, unknown>;
}

export interface PackageManagerOutput {
  installed?: string[];
  updated?: string[];
  vulnerabilities?: Array<{ package: string; severity: string }>;
}

export interface IPackageManagerPort extends Port<PackageManagerInput, PackageManagerOutput> {}

// ----------------------------------------------------------------

export interface SandboxExecInput {
  method: "exec" | "readFile" | "writeFile";
  args?: Record<string, unknown>;
}

export interface SandboxExecOutput {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  content?: string;
}

export interface ISandboxExecPort extends Port<SandboxExecInput, SandboxExecOutput> {}

// ----------------------------------------------------------------

export interface QueryProfilerInput {
  method: "profile" | "getRecommendations";
  args?: Record<string, unknown>;
}

export interface QueryProfilerOutput {
  profile?: { duration: number; scans: number; indexes: string[] };
  recommendations?: Array<{ query: string; suggestion: string }>;
}

export interface IQueryProfilerPort extends Port<QueryProfilerInput, QueryProfilerOutput> {}

// ----------------------------------------------------------------

export interface DbClientInput {
  method: "query" | "execute" | "listTables" | "describeTable";
  args?: Record<string, unknown>;
}

export interface DbClientOutput {
  rows?: Array<Record<string, unknown>>;
  affected?: number;
  tables?: string[];
  columns?: Array<{ name: string; type: string }>;
}

export interface IDbClientPort extends Port<DbClientInput, DbClientOutput> {}

// ----------------------------------------------------------------

export interface MigrationsInput {
  method: "migrate" | "rollback" | "status";
  args?: Record<string, unknown>;
}

export interface MigrationsOutput {
  applied?: string[];
  rolledBack?: string[];
  pending?: string[];
}

export interface IMigrationsPort extends Port<MigrationsInput, MigrationsOutput> {}

// ----------------------------------------------------------------

export interface VectorStoreInput {
  method: "search" | "insert" | "delete";
  args?: Record<string, unknown>;
}

export interface VectorStoreOutput {
  results?: Array<{ id: string; score: number; content: string }>;
  inserted?: boolean;
  deleted?: boolean;
}

export interface IVectorStorePort extends Port<VectorStoreInput, VectorStoreOutput> {}

// ----------------------------------------------------------------

export interface TranscriptionInput {
  method: "transcribe" | "translate";
  args?: Record<string, unknown>;
}

export interface TranscriptionOutput {
  text?: string;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface ITranscriptionPort extends Port<TranscriptionInput, TranscriptionOutput> {}

// ----------------------------------------------------------------

export interface ConfluenceNotionInput {
  method: "getPage" | "createPage" | "search";
  args?: Record<string, unknown>;
}

export interface ConfluenceNotionOutput {
  page?: { id: string; title: string; url: string };
  pages?: Array<{ id: string; title: string; url: string }>;
  created?: boolean;
}

export interface IConfluenceNotionPort extends Port<
  ConfluenceNotionInput,
  ConfluenceNotionOutput
> {}

// ----------------------------------------------------------------

export interface AnalyticsInput {
  method: "query" | "getMetrics" | "getTrends";
  args?: Record<string, unknown>;
}

export interface AnalyticsOutput {
  data?: Array<Record<string, unknown>>;
  metrics?: Record<string, number>;
  trends?: Array<{ date: string; value: number }>;
}

export interface IAnalyticsPort extends Port<AnalyticsInput, AnalyticsOutput> {}
