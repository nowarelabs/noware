"use agent";

import {
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
  useSkill,
  useSubagent,
  useTool,
  bash,
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import { confluenceNotionTool } from "../tools/confluence-notion-tool";
import { docsGeneratorTool } from "../tools/docs-generator-tool";

interface DocsState {
  status: "idle" | "writing" | "done";
  page: string;
}

function DocsReviewer() {
  return `You are a documentation reviewer. Given a draft page and its audience, check it for clarity, working examples, task orientation, and information-architecture consistency. Return APPROVED or REVISE with the specific issue and a one-line fix. Be terse.`;
}

export function Documentation() {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "low",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Write task-oriented documentation organized by user journey: getting started, guides, reference, troubleshooting. Keep headings, cross-links, and terminology consistent. Use active voice, concrete examples, and the minimum words needed. Keep the audience explicit, prefer working examples over abstract prose, and never publish a page that has not been reviewed by the docs-reviewer subagent. Page creates and updates are durable: they are recorded and replayed, never duplicated, after a crash.",
  );

  const [docs, setDocs] = usePersistentState<DocsState>("docs", {
    status: "idle",
    page: "",
  });

  const writeDocs = useDataWriter("docs", {
    schema: v.object({
      status: v.picklist(["idle", "writing", "done"]),
      page: v.string(),
      audience: v.string(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ page?: string; audience?: string }>();

  useAgentStart(({ log }) => {
    const page =
      docs.page ||
      initialData?.page ||
      (delivery.kind === "signal" ? delivery.attributes?.page : undefined) ||
      "untitled";
    const audience = initialData?.audience || "end users";
    log.info("docs.started", { page, audience });
    setDocs((prev) => ({ ...prev, status: "writing", page }));
    writeDocs({ status: "writing", page, audience });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info("docs.finished", { toolCalls: response.toolCalls.length });
    setDocs((prev) => ({ ...prev, status: "done" }));
    writeDocs({ status: "done", page: docs.page, audience: initialData?.audience || "end users" });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent({
    name: "docs-reviewer",
    description:
      "Reviews a documentation draft for clarity, examples, and information-architecture consistency before it is published.",
    agent: DocsReviewer,
  });
  useTool(confluenceNotionTool);
  useTool(docsGeneratorTool);

  return `You are the Documentation agent. Write clear, task-oriented documentation organized by user journey. Keep the audience explicit, use working examples over abstract prose, and keep information architecture consistent.`;
}
