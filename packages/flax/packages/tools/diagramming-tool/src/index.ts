import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

const diagrams = new Map<string, string>();

function dataUrl(content: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
}

function fromJson(description: any): string {
  const type = description.type ?? "flowchart";
  if (type === "sequence") {
    const participants = description.participants ?? [];
    const messages = description.messages ?? [];
    const lines = ["sequenceDiagram"];
    for (const p of participants) lines.push(`  participant ${p}`);
    for (const m of messages) {
      if (Array.isArray(m) && m.length === 3) lines.push(`  ${m[0]}->>${m[1]}: ${m[2]}`);
      else if (typeof m === "string") lines.push(`  Note over all: ${m}`);
    }
    return lines.join("\n");
  }
  if (type === "er") {
    const entities = description.entities ?? [];
    const lines = ["erDiagram"];
    for (const e of entities) {
      const name = typeof e === "string" ? e : e.name;
      const attrs = typeof e === "string" ? [] : (e.attributes ?? []);
      lines.push(`  ${name} {`);
      for (const attr of attrs) lines.push(`    ${attr}`);
      lines.push("  }");
    }
    return lines.join("\n");
  }

  const direction = description.direction ?? "TD";
  const nodes = description.nodes ?? [];
  const edges = description.edges ?? [];
  const lines = [`flowchart ${direction}`];
  for (const n of nodes) {
    if (Array.isArray(n) && n.length === 2) lines.push(`  ${n[0]}["${String(n[1]).replace(/"/g, "'")}"]`);
    else lines.push(`  ${String(n).replace(/\s+/g, "_")}["${n}"]`);
  }
  for (const e of edges) {
    if (Array.isArray(e) && e.length === 3) lines.push(`  ${e[0]} -->|${e[2]}| ${e[1]}`);
    else if (Array.isArray(e) && e.length === 2) lines.push(`  ${e[0]} --> ${e[1]}`);
  }
  return lines.join("\n");
}

function fromText(description: string): string {
  const lines = description.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (/^(sequenceDiagram|erDiagram|flowchart|graph\s)/i.test(lines[0] ?? "")) {
    return lines.join("\n");
  }
  const hasEdges = lines.some((l) => /(-->|->>|-->|->)/.test(l));
  if (hasEdges) return ["flowchart LR", ...lines].join("\n");
  const nodes = lines.slice(0, 20).map((l, i) => `  n${i}["${l.replace(/["\[\]{}<>]/g, "")}"]`);
  return ["flowchart TD", ...nodes].join("\n");
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class DiagrammingTool extends WorkerEntrypoint<Env> {
  async generateDiagram(input: { description: string; format?: string }): Promise<{ diagramUrl: string }> {
    const mermaid = typeof input.description === "string" ? fromText(input.description) : fromJson(input.description);
    const id = `diagram-${crypto.randomUUID()}`;
    diagrams.set(id, mermaid);
    return { diagramUrl: dataUrl(mermaid) };
  }

  async exportDiagram(input: { diagramId: string; format: string }): Promise<{ exportUrl: string }> {
    const mermaid = diagrams.get(input.diagramId) ?? (input as unknown as { mermaid?: string }).mermaid;
    if (!mermaid) throw new Error(`diagram ${input.diagramId} not found`);
    const format = (input.format ?? "svg").toLowerCase();
    const supported = ["svg", "png", "pdf"];
    if (!supported.includes(format)) throw new Error(`unsupported format "${format}" (supported: ${supported.join(", ")})`);
    const encoded = toBase64Url(mermaid);
    const exportUrl = `https://kroki.io/mermaid/${format}/${encoded}`;
    return { exportUrl };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
