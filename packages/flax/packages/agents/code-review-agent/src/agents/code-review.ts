"use agent";

import {
  GeneralSubagent,
  useAgentFinish,
  useAgentStart,
  useDataWriter,
  useDelivery,
  useInitialData,
  useInstruction,
  useModel,
  usePersistentState,
  useResponseFinish,
  useResponseStart,
  useSandbox,
  useSubagent,
  useTool,
  bash,
  defineAgent,
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import { ciStatusTool } from "../tools/ci-status-tool";
import { githubTool } from "../tools/github-tool";
import { staticAnalysisTool } from "../tools/static-analysis-tool";

interface ReviewState {
  status: "idle" | "reviewing" | "done";
  repo: string;
  findings: string[];
}

const codeReview = defineAgent("code-review", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "medium",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Separate blockers from nits and never invent issues to look thorough. Every finding must reference a real location in the code you actually inspected. Flag duplication, long functions, deep nesting, premature abstraction, and unclear naming, and suggest concrete minimal refactors. Review for injection, authn/authz bypass, secrets, unsafe deserialization, and dependency risk, referencing OWASP guidance and ranking findings by exploitability. Check formatting, naming, and structural rules from the project style guide and separate style nits from correctness issues. When a change spans many files, delegate per-file review to the file-reviewer subagent in parallel.",
  );

  const [review, setReview] = usePersistentState<ReviewState>("review", {
    status: "idle",
    repo: "",
    findings: [],
  });

  const writeReview = useDataWriter("review", {
    schema: v.object({
      status: v.picklist(["idle", "reviewing", "done"]),
      repo: v.string(),
      blockerCount: v.number(),
      nitCount: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ repo?: string; branch?: string }>();

  useAgentStart(({ log }) => {
    const repo =
      review.repo ||
      initialData?.repo ||
      (delivery.kind === "signal" ? delivery.attributes?.repo : undefined) ||
      "";
    log.info("review.started", { repo, branch: initialData?.branch });
    setReview({ ...review, status: "reviewing", repo });
    writeReview({ status: "reviewing", repo, blockerCount: 0, nitCount: 0 });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => {
    const r = response as { toolCalls?: unknown[] };
    return {
      elapsedMs: Date.now() - (metadata.startedAt as number),
      toolCalls: r.toolCalls?.length ?? 0,
    };
  });

  useAgentFinish(({ log, response }) => {
    const r = response as { toolCalls?: unknown[] };
    log.info("review.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setReview({ ...review, status: "done" });
    writeReview({
      status: "done",
      repo: review.repo,
      blockerCount: 0,
      nitCount: review.findings.length,
    });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent(
    "file-reviewer",
    "Reviews one file or diff and returns ranked findings with severity. Use for parallel per-file review of a large change.",
    GeneralSubagent,
  );
  useTool(ciStatusTool);
  useTool(githubTool);
  useTool(staticAnalysisTool);

  return `You are the Code Review agent. Review code for maintainability, security, and style, and return concrete ranked findings with file references and suggested fixes. Be specific rather than pedantic, and separate blockers from nits.`;
});

export default codeReview;
