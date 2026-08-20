import type { GateResult } from "../types.js";

export interface Claim {
  agent: string;
  claim: string;
  truthValue: boolean;
  timestamp: number;
}

export interface Contradiction {
  claimA: Claim;
  claimB: Claim;
}

export class ConsistencyChecker {
  private claims: Claim[] = [];

  recordClaim(agent: string, claim: string, truthValue: boolean): void {
    this.claims.push({
      agent,
      claim,
      truthValue,
      timestamp: Date.now(),
    });
  }

  detectContradictions(): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < this.claims.length; i++) {
      for (let j = i + 1; j < this.claims.length; j++) {
        const a = this.claims[i]!;
        const b = this.claims[j]!;
        if (a.claim === b.claim && a.agent !== b.agent && a.truthValue !== b.truthValue) {
          contradictions.push({ claimA: a, claimB: b });
        }
      }
    }

    return contradictions;
  }

  getAgentAgreement(agent: string): number {
    const agentClaims = this.claims.filter((c) => c.agent === agent);
    if (agentClaims.length === 0) return 1;

    const truthCount = agentClaims.filter((c) => c.truthValue).length;
    return truthCount / agentClaims.length;
  }
}

export function consistencyGate(
  input: unknown,
  context: { sourceAgent?: string },
  checker: ConsistencyChecker,
): GateResult {
  if (typeof input !== "object" || input === null) {
    return { pass: true, gate: "consistency" };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.claim === "string" && typeof obj.truthValue === "boolean" && context.sourceAgent) {
    checker.recordClaim(context.sourceAgent, obj.claim, obj.truthValue);

    const contradictions = checker.detectContradictions();
    if (contradictions.length > 0) {
      const latest = contradictions[contradictions.length - 1]!;
      return {
        pass: false,
        gate: "consistency",
        reason: `Contradiction detected between agents "${latest.claimA.agent}" and "${latest.claimB.agent}" on claim: "${latest.claimA.claim}"`,
        metadata: { contradictions: contradictions.length },
      };
    }
  }

  return { pass: true, gate: "consistency" };
}
