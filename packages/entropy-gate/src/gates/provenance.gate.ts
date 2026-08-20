import type { GateResult } from "../types.js";

export interface ProvenanceRecord {
  agent: string;
  dataHash: string;
  parentHash?: string;
  timestamp: number;
}

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class ProvenanceTracker {
  private records: ProvenanceRecord[] = [];
  private seen = new Set<string>();

  async hash(data: unknown): Promise<string> {
    return sha256Hex(JSON.stringify(data));
  }

  async track(agent: string, data: unknown, parentHash?: string): Promise<string> {
    const dataHash = await this.hash(data);

    const record: ProvenanceRecord = {
      agent,
      dataHash,
      parentHash,
      timestamp: Date.now(),
    };

    this.records.push(record);
    this.seen.add(dataHash);

    return dataHash;
  }

  detectCycle(agent: string, dataHash: string): boolean {
    const agentRecords = this.records.filter((r) => r.agent === agent);
    return agentRecords.some((r) => r.dataHash === dataHash);
  }

  getAuditTrail(agent: string): ProvenanceRecord[] {
    return this.records.filter((r) => r.agent === agent);
  }
}

export async function provenanceGate(
  input: unknown,
  context: { sourceAgent?: string },
  tracker: ProvenanceTracker,
): Promise<GateResult> {
  if (!context.sourceAgent) {
    return { pass: true, gate: "provenance" };
  }

  const dataHash = await tracker.hash(input);

  if (tracker.detectCycle(context.sourceAgent, dataHash)) {
    return {
      pass: false,
      gate: "provenance",
      reason: `Possible echo detected: agent "${context.sourceAgent}" has already processed this data`,
      metadata: { dataHash },
    };
  }

  await tracker.track(context.sourceAgent, input);

  return { pass: true, gate: "provenance", metadata: { dataHash } };
}
