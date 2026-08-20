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
  useSkill,
  useSubagent,
  useTool,
  bash,
} from "@nowarelabs/agents";
import * as v from "valibot";
import { Bash, InMemoryFs } from "just-bash";

import strideThreatModeling from "../skills/stride-threat-modeling/SKILL.md";
import { pentestTool } from "../tools/pentest-tool";
import { sbomTool } from "../tools/sbom-tool";
import { securityScanTool } from "../tools/security-scan-tool";

interface ScanState {
  status: "idle" | "scanning" | "done";
  target: string;
  critical: number;
  high: number;
}

const agent = defineAgent("security-appsec", () => {
  useModel("cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct", {
    thinkingLevel: "medium",
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    "Assess risk against the OWASP Top 10: check for injection, broken authentication, XSS, insecure deserialization, SSRF, misconfiguration, and known CVEs. Apply secure defaults, least privilege, input validation, output encoding, and defense in depth. Report severity, exploitability, and concrete remediation for every finding, ranked by exploitability and impact. Never claim a scan passed without actually running it. Scans are durable: completed scans are recorded and replayed, never duplicated, after a crash.",
  );

  const [scan, setScan] = usePersistentState<ScanState>("scan", {
    status: "idle",
    target: "",
    critical: 0,
    high: 0,
  });

  const writeSecurity = useDataWriter("security", {
    schema: v.object({
      status: v.picklist(["idle", "scanning", "done"]),
      target: v.string(),
      critical: v.number(),
      high: v.number(),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ target?: string }>();

  useAgentStart(({ log }) => {
    const target =
      scan.target ||
      initialData?.target ||
      (delivery.kind === "signal" ? delivery.attributes?.target : undefined) ||
      "application";
    log.info("scan.started", { target });
    setScan({ ...scan, status: "scanning", target });
    writeSecurity({ status: "scanning", target, critical: 0, high: 0 });
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
    log.info("scan.finished", { toolCalls: r.toolCalls?.length ?? 0 });
    setScan({ ...scan, status: "done" });
    writeSecurity({
      status: "done",
      target: scan.target,
      critical: scan.critical,
      high: scan.high,
    });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSkill({
    name: "stride-threat-modeling",
    description:
      "STRIDE threat modeling methodology for identifying and mitigating security threats",
    content: strideThreatModeling,
  });
  useSubagent(
    "threat-model-reviewer",
    "Reviews a STRIDE threat model for missed trust boundaries and missing mitigations before it is accepted.",
    GeneralSubagent,
  );
  useTool(pentestTool);
  useTool(sbomTool);
  useTool(securityScanTool);

  return `You are the Security/AppSec agent. Assess risk against the OWASP Top 10, threat-model components with STRIDE, and enforce secure coding practices. Report severity, exploitability, and concrete remediation for every finding.`;
});

export default agent;
