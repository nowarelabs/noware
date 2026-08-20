/**
 * @nowarelabs/agent-gateways — gateway implementations for agent tools.
 *
 * Gateways implement Port interfaces by calling external services.
 * Each gateway wraps a Cloudflare service binding (RPC) to a tool Worker.
 *
 * ## Convention
 *
 * One gateway per tool backend:
 * ```typescript
 * export class JiraLinearGateway extends BaseGateway implements IJiraLinearPort { ... }
 * ```
 *
 * ## Data flow (unidirectional)
 *
 * ```
 * UseCase → Port → Gateway → External (tool Worker via RPC)
 * ```
 *
 * The gateway translates between the port interface and the actual
 * service binding calls. It handles error mapping, response parsing,
 * and retry logic.
 */

import { BaseGateway } from "@nowarelabs/gateways";
import type { UseCaseResult } from "@nowarelabs/shared";
import type {
  IJiraLinearPort,
  JiraLinearInput,
  JiraLinearOutput,
  IDispatchAgentPort,
  DispatchAgentInput,
  DispatchAgentOutput,
  ITaskQueuePort,
  TaskQueueInput,
  TaskQueueOutput,
  IHitlPort,
  HitlInput,
  HitlOutput,
  ICloudPricingPort,
  CloudPricingInput,
  CloudPricingOutput,
  IDiagrammingPort,
  DiagrammingInput,
  DiagrammingOutput,
  IIacPort,
  IacInput,
  IacOutput,
  IGitHubPort,
  GitHubInput,
  GitHubOutput,
  IStaticAnalysisPort,
  StaticAnalysisInput,
  StaticAnalysisOutput,
  ICiStatusPort,
  CiStatusInput,
  CiStatusOutput,
  ISecurityScanPort,
  SecurityScanInput,
  SecurityScanOutput,
  ISupportTicketsPort,
  SupportTicketsInput,
  SupportTicketsOutput,
  ISentimentAnalysisPort,
  SentimentAnalysisInput,
  SentimentAnalysisOutput,
  IWebSearchPort,
  WebSearchInput,
  WebSearchOutput,
  ICoveragePort,
  CoverageInput,
  CoverageOutput,
  ITestRunnerPort,
  TestRunnerInput,
  TestRunnerOutput,
  ILogAggregationPort,
  LogAggregationInput,
  LogAggregationOutput,
  IMonitoringPort,
  MonitoringInput,
  MonitoringOutput,
  IPagerDutyPort,
  PagerDutyInput,
  PagerDutyOutput,
  IImageGenPort,
  ImageGenInput,
  ImageGenOutput,
  IFigmaPort,
  FigmaInput,
  FigmaOutput,
  IAccessibilityPort,
  AccessibilityInput,
  AccessibilityOutput,
  IFeatureFlagsPort,
  FeatureFlagsInput,
  FeatureFlagsOutput,
  IChangelogPort,
  ChangelogInput,
  ChangelogOutput,
  IDocsGeneratorPort,
  DocsGeneratorInput,
  DocsGeneratorOutput,
  ISbomPort,
  SbomInput,
  SbomOutput,
  ICicdPipelinePort,
  CicdPipelineInput,
  CicdPipelineOutput,
  IPackageManagerPort,
  PackageManagerInput,
  PackageManagerOutput,
  ISandboxExecPort,
  SandboxExecInput,
  SandboxExecOutput,
  IQueryProfilerPort,
  QueryProfilerInput,
  QueryProfilerOutput,
  IDbClientPort,
  DbClientInput,
  DbClientOutput,
  IMigrationsPort,
  MigrationsInput,
  MigrationsOutput,
  IVectorStorePort,
  VectorStoreInput,
  VectorStoreOutput,
  ITranscriptionPort,
  TranscriptionInput,
  TranscriptionOutput,
  IConfluenceNotionPort,
  ConfluenceNotionInput,
  ConfluenceNotionOutput,
  IAnalyticsPort,
  AnalyticsInput,
  AnalyticsOutput,
} from "@nowarelabs/agent-ports";

// ----------------------------------------------------------------
// Helper — wraps an RPC call in UseCaseResult
// ----------------------------------------------------------------

async function callRpc<T>(
  binding: unknown,
  method: string,
  args?: Record<string, unknown>,
): Promise<UseCaseResult<T>> {
  try {
    const rpc = binding as Record<string, (input: unknown) => Promise<T>>;
    const data = await rpc[method](args ?? {});
    return { success: true, data, status: "delivered" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
      status: "abandoned",
    };
  }
}

// ----------------------------------------------------------------
// Tool gateways — one per tool backend
// ----------------------------------------------------------------

export class JiraLinearGateway extends BaseGateway implements IJiraLinearPort {
  async execute(input: JiraLinearInput): Promise<UseCaseResult<JiraLinearOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.JIRA_LINEAR_TOOL;
    return callRpc<JiraLinearOutput>(binding, input.method, input.args);
  }
}

export class DispatchAgentGateway extends BaseGateway implements IDispatchAgentPort {
  async execute(input: DispatchAgentInput): Promise<UseCaseResult<DispatchAgentOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.DISPATCH_AGENT;
    return callRpc<DispatchAgentOutput>(
      binding,
      "dispatch",
      input as unknown as Record<string, unknown>,
    );
  }
}

export class TaskQueueGateway extends BaseGateway implements ITaskQueuePort {
  async execute(input: TaskQueueInput): Promise<UseCaseResult<TaskQueueOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.TASK_QUEUE_TOOL;
    return callRpc<TaskQueueOutput>(binding, input.method, input.args);
  }
}

export class HitlGateway extends BaseGateway implements IHitlPort {
  async execute(input: HitlInput): Promise<UseCaseResult<HitlOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.HITL_TOOL;
    return callRpc<HitlOutput>(binding, input.method, input as unknown as Record<string, unknown>);
  }
}

export class CloudPricingGateway extends BaseGateway implements ICloudPricingPort {
  async execute(input: CloudPricingInput): Promise<UseCaseResult<CloudPricingOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.CLOUD_PRICING_TOOL;
    return callRpc<CloudPricingOutput>(binding, input.method, input.args);
  }
}

export class DiagrammingGateway extends BaseGateway implements IDiagrammingPort {
  async execute(input: DiagrammingInput): Promise<UseCaseResult<DiagrammingOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.DIAGRAMMING_TOOL;
    return callRpc<DiagrammingOutput>(binding, input.method, input.args);
  }
}

export class IacGateway extends BaseGateway implements IIacPort {
  async execute(input: IacInput): Promise<UseCaseResult<IacOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.IAC_TOOL;
    return callRpc<IacOutput>(binding, input.method, input.args);
  }
}

export class GitHubGateway extends BaseGateway implements IGitHubPort {
  async execute(input: GitHubInput): Promise<UseCaseResult<GitHubOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.GITHUB_TOOL;
    return callRpc<GitHubOutput>(binding, input.method, input.args);
  }
}

export class StaticAnalysisGateway extends BaseGateway implements IStaticAnalysisPort {
  async execute(input: StaticAnalysisInput): Promise<UseCaseResult<StaticAnalysisOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.STATIC_ANALYSIS_TOOL;
    return callRpc<StaticAnalysisOutput>(binding, input.method, input.args);
  }
}

export class CiStatusGateway extends BaseGateway implements ICiStatusPort {
  async execute(input: CiStatusInput): Promise<UseCaseResult<CiStatusOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.CI_STATUS_TOOL;
    return callRpc<CiStatusOutput>(binding, input.method, input.args);
  }
}

export class SecurityScanGateway extends BaseGateway implements ISecurityScanPort {
  async execute(input: SecurityScanInput): Promise<UseCaseResult<SecurityScanOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.SECURITY_SCAN_TOOL;
    return callRpc<SecurityScanOutput>(binding, input.method, input.args);
  }
}

export class SupportTicketsGateway extends BaseGateway implements ISupportTicketsPort {
  async execute(input: SupportTicketsInput): Promise<UseCaseResult<SupportTicketsOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.SUPPORT_TICKETS_TOOL;
    return callRpc<SupportTicketsOutput>(binding, input.method, input.args);
  }
}

export class SentimentAnalysisGateway extends BaseGateway implements ISentimentAnalysisPort {
  async execute(input: SentimentAnalysisInput): Promise<UseCaseResult<SentimentAnalysisOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env
      .SENTIMENT_ANALYSIS_TOOL;
    return callRpc<SentimentAnalysisOutput>(binding, input.method, input.args);
  }
}

export class WebSearchGateway extends BaseGateway implements IWebSearchPort {
  async execute(input: WebSearchInput): Promise<UseCaseResult<WebSearchOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.WEB_SEARCH_TOOL;
    return callRpc<WebSearchOutput>(binding, input.method, input.args);
  }
}

export class CoverageGateway extends BaseGateway implements ICoveragePort {
  async execute(input: CoverageInput): Promise<UseCaseResult<CoverageOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.COVERAGE_TOOL;
    return callRpc<CoverageOutput>(binding, input.method, input.args);
  }
}

export class TestRunnerGateway extends BaseGateway implements ITestRunnerPort {
  async execute(input: TestRunnerInput): Promise<UseCaseResult<TestRunnerOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.TEST_RUNNER_TOOL;
    return callRpc<TestRunnerOutput>(binding, input.method, input.args);
  }
}

export class LogAggregationGateway extends BaseGateway implements ILogAggregationPort {
  async execute(input: LogAggregationInput): Promise<UseCaseResult<LogAggregationOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.LOG_AGGREGATION_TOOL;
    return callRpc<LogAggregationOutput>(binding, input.method, input.args);
  }
}

export class MonitoringGateway extends BaseGateway implements IMonitoringPort {
  async execute(input: MonitoringInput): Promise<UseCaseResult<MonitoringOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.MONITORING_TOOL;
    return callRpc<MonitoringOutput>(binding, input.method, input.args);
  }
}

export class PagerDutyGateway extends BaseGateway implements IPagerDutyPort {
  async execute(input: PagerDutyInput): Promise<UseCaseResult<PagerDutyOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.PAGERDUTY_TOOL;
    return callRpc<PagerDutyOutput>(binding, input.method, input.args);
  }
}

export class ImageGenGateway extends BaseGateway implements IImageGenPort {
  async execute(input: ImageGenInput): Promise<UseCaseResult<ImageGenOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.IMAGE_GEN_TOOL;
    return callRpc<ImageGenOutput>(binding, input.method, input.args);
  }
}

export class FigmaGateway extends BaseGateway implements IFigmaPort {
  async execute(input: FigmaInput): Promise<UseCaseResult<FigmaOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.FIGMA_TOOL;
    return callRpc<FigmaOutput>(binding, input.method, input.args);
  }
}

export class AccessibilityGateway extends BaseGateway implements IAccessibilityPort {
  async execute(input: AccessibilityInput): Promise<UseCaseResult<AccessibilityOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.ACCESSIBILITY_TOOL;
    return callRpc<AccessibilityOutput>(binding, input.method, input.args);
  }
}

export class FeatureFlagsGateway extends BaseGateway implements IFeatureFlagsPort {
  async execute(input: FeatureFlagsInput): Promise<UseCaseResult<FeatureFlagsOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.FEATURE_FLAGS_TOOL;
    return callRpc<FeatureFlagsOutput>(binding, input.method, input.args);
  }
}

export class ChangelogGateway extends BaseGateway implements IChangelogPort {
  async execute(input: ChangelogInput): Promise<UseCaseResult<ChangelogOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.CHANGELOG_TOOL;
    return callRpc<ChangelogOutput>(binding, input.method, input.args);
  }
}

export class DocsGeneratorGateway extends BaseGateway implements IDocsGeneratorPort {
  async execute(input: DocsGeneratorInput): Promise<UseCaseResult<DocsGeneratorOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.DOCS_GENERATOR_TOOL;
    return callRpc<DocsGeneratorOutput>(binding, input.method, input.args);
  }
}

export class SbomGateway extends BaseGateway implements ISbomPort {
  async execute(input: SbomInput): Promise<UseCaseResult<SbomOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.SBOM_TOOL;
    return callRpc<SbomOutput>(binding, input.method, input.args);
  }
}

export class CicdPipelineGateway extends BaseGateway implements ICicdPipelinePort {
  async execute(input: CicdPipelineInput): Promise<UseCaseResult<CicdPipelineOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.CICD_PIPELINE_TOOL;
    return callRpc<CicdPipelineOutput>(binding, input.method, input.args);
  }
}

export class PackageManagerGateway extends BaseGateway implements IPackageManagerPort {
  async execute(input: PackageManagerInput): Promise<UseCaseResult<PackageManagerOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.PACKAGE_MANAGER_TOOL;
    return callRpc<PackageManagerOutput>(binding, input.method, input.args);
  }
}

export class SandboxExecGateway extends BaseGateway implements ISandboxExecPort {
  async execute(input: SandboxExecInput): Promise<UseCaseResult<SandboxExecOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.SANDBOX_EXEC_TOOL;
    return callRpc<SandboxExecOutput>(binding, input.method, input.args);
  }
}

export class QueryProfilerGateway extends BaseGateway implements IQueryProfilerPort {
  async execute(input: QueryProfilerInput): Promise<UseCaseResult<QueryProfilerOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.QUERY_PROFILER_TOOL;
    return callRpc<QueryProfilerOutput>(binding, input.method, input.args);
  }
}

export class DbClientGateway extends BaseGateway implements IDbClientPort {
  async execute(input: DbClientInput): Promise<UseCaseResult<DbClientOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.DB_CLIENT_TOOL;
    return callRpc<DbClientOutput>(binding, input.method, input.args);
  }
}

export class MigrationsGateway extends BaseGateway implements IMigrationsPort {
  async execute(input: MigrationsInput): Promise<UseCaseResult<MigrationsOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.MIGRATIONS_TOOL;
    return callRpc<MigrationsOutput>(binding, input.method, input.args);
  }
}

export class VectorStoreGateway extends BaseGateway implements IVectorStorePort {
  async execute(input: VectorStoreInput): Promise<UseCaseResult<VectorStoreOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.VECTOR_STORE_TOOL;
    return callRpc<VectorStoreOutput>(binding, input.method, input.args);
  }
}

export class TranscriptionGateway extends BaseGateway implements ITranscriptionPort {
  async execute(input: TranscriptionInput): Promise<UseCaseResult<TranscriptionOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.TRANSCRIPTION_TOOL;
    return callRpc<TranscriptionOutput>(binding, input.method, input.args);
  }
}

export class ConfluenceNotionGateway extends BaseGateway implements IConfluenceNotionPort {
  async execute(input: ConfluenceNotionInput): Promise<UseCaseResult<ConfluenceNotionOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env
      .CONFLUENCE_NOTION_TOOL;
    return callRpc<ConfluenceNotionOutput>(binding, input.method, input.args);
  }
}

export class AnalyticsGateway extends BaseGateway implements IAnalyticsPort {
  async execute(input: AnalyticsInput): Promise<UseCaseResult<AnalyticsOutput>> {
    const binding = (this as unknown as { env: Record<string, unknown> }).env.ANALYTICS_TOOL;
    return callRpc<AnalyticsOutput>(binding, input.method, input.args);
  }
}
