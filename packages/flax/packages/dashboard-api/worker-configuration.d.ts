/* eslint-disable */
// Hand-maintained to match wrangler.jsonc. Regenerate with `pnpm run cf-typegen`.

interface __BaseEnv_Env {
	FLAX_DB: D1Database;
	ASSETS: Fetcher;
	ORCHESTRATOR_AGENT: Service /* entrypoint default from orchestrator-agent */;
	CODING_AGENT: Service /* entrypoint default from coding-agent */;
	CODE_REVIEW_AGENT: Service /* entrypoint default from code-review-agent */;
	QA_TEST_AGENT: Service /* entrypoint default from qa-test-agent */;
	SECURITY_APPSEC_AGENT: Service /* entrypoint default from security-appsec-agent */;
	SOLUTIONS_ARCHITECT_AGENT: Service /* entrypoint default from solutions-architect-agent */;
	DOCUMENTATION_AGENT: Service /* entrypoint default from documentation-agent */;
	RELEASE_MANAGER_AGENT: Service /* entrypoint default from release-manager-agent */;
	GITHUB_TOOL: Service /* entrypoint GithubTool from github-tool */;
	JIRA_LINEAR_TOOL: Service /* entrypoint JiraLinearTool from jira-linear-tool */;
}

declare namespace Cloudflare {
	interface Env extends __BaseEnv_Env {}
}

interface Env extends __BaseEnv_Env {}
