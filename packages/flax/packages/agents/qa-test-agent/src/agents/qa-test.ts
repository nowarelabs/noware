"use agent";

import {
  GeneralSubagent,
  defineAgent,
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
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import { ciStatusTool } from "../tools/ci-status-tool";
import { coverageTool } from "../tools/coverage-tool";
import { testRunnerTool } from "../tools/test-runner-tool";

interface TestRunState {
  status: "idle" | "designing" | "running" | "done";
  suite: string;
}

const agent = defineAgent("qa-test", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "medium",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Design tests that express behavior first with Given/When/Then, keeping tests independent, fast, and deterministic with one behavior per test. Cover happy paths, error paths, boundaries, equivalence classes, and state transitions. Mock at process boundaries only and stub external I/O, preferring contract tests over brittle, implementation-coupled mocks. Keep suites focused on risk. Test runs are durable: completed runs are recorded and replayed, never duplicated, after a crash.",
  );

  const [testRun, setTestRun] = usePersistentState<TestRunState>("testrun", {
    status: "idle",
    suite: "",
  });

  const writeQa = useDataWriter("qa", {
    schema: v.object({
      status: v.picklist(["idle", "designing", "running", "done"]),
      suite: v.string(),
      passed: v.number(),
      failed: v.number(),
      coverage: v.optional(v.number()),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ suite?: string }>();

  useAgentStart(({ log }) => {
    const suite =
      testRun.suite ||
      initialData?.suite ||
      (delivery.kind === "signal" ? delivery.attributes?.suite : undefined) ||
      "unit";
    log.info("qa.started", { suite });
    setTestRun({ ...testRun, status: "designing", suite });
    writeQa({ status: "designing", suite, passed: 0, failed: 0 });
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
    log.info("qa.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setTestRun({ ...testRun, status: "done" });
    writeQa({ status: "done", suite: testRun.suite, passed: 0, failed: 0 });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent(
    "test-case-designer",
    "Produces a focused set of test cases for a behavior, covering happy path, failure path, boundaries, and transitions.",
    GeneralSubagent,
  );
  useTool(ciStatusTool);
  useTool(coverageTool);
  useTool(testRunnerTool);

  return `You are the QA/Test agent. Design tests that express behavior first, cover happy paths and failure paths, and mock at the right boundaries. Keep suites fast, deterministic, and focused on risk.`;
});

export default agent;
