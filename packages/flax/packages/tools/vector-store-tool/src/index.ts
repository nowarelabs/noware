import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<any>;
}

interface StoredVector {
  id: string;
  vector: number[];
  metadata?: unknown;
}

const stores = new Map<string, Map<string, StoredVector>>();

function store(namespace: string): Map<string, StoredVector> {
  if (!stores.has(namespace)) stores.set(namespace, new Map());
  return stores.get(namespace)!;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function embed(ai: AiBinding | undefined, text: string): Promise<number[]> {
  if (!ai) throw new Error("no vector provided and no AI binding available for embeddings");
  const result = await ai.run("@cf/baai/bge-small-en-v1.5", { text: [text] });
  const embedding = result?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("embedding model returned an unexpected payload");
  return embedding as number[];
}

interface VectorInput {
  id?: string;
  vector?: number[];
  text?: string;
  values?: number[];
  metadata?: unknown;
}

function matchesFilter(metadata: unknown, filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;
  const meta = (metadata ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
    if (meta[key] !== value) return false;
  }
  return true;
}

export class VectorStoreTool extends WorkerEntrypoint<Env> {
  async upsert(input: {
    namespace: string;
    vectors: unknown[];
    metadata?: unknown;
  }): Promise<{ count: number }> {
    const ai = this.env.AI as AiBinding | undefined;
    const items = (input.vectors as VectorInput[]) ?? [];
    const ns = store(input.namespace);

    for (const item of items) {
      const id = item.id ?? `vec-${crypto.randomUUID()}`;
      let vector = item.vector ?? item.values;
      if (!vector && item.text) vector = await embed(ai, item.text);
      if (!Array.isArray(vector))
        throw new Error(`vector #${id} has no vector and no text to embed`);
      ns.set(id, { id, vector, metadata: item.metadata ?? input.metadata });
    }
    return { count: items.length };
  }

  async query(input: {
    namespace: string;
    vector: number[];
    topK?: number;
    filter?: unknown;
  }): Promise<unknown> {
    const ai = this.env.AI as AiBinding | undefined;
    const ns = store(input.namespace);
    const topK = input.topK ?? 10;
    let queryVector = input.vector;
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error("query requires a vector (or pass filter-only text via a prior upsert)");
    }
    void ai;

    const scored = [...ns.values()]
      .filter((item) => matchesFilter(item.metadata, input.filter))
      .map((item) => ({
        id: item.id,
        score: cosine(queryVector, item.vector),
        metadata: item.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return { namespace: input.namespace, matches: scored, matchCount: scored.length };
  }

  async delete(input: { namespace: string; ids?: string[] }): Promise<{ deleted: number }> {
    const ns = store(input.namespace);
    let deleted = 0;
    if (!input.ids || input.ids.length === 0) {
      deleted = ns.size;
      stores.delete(input.namespace);
    } else {
      for (const id of input.ids) {
        if (ns.delete(id)) deleted++;
      }
    }
    return { deleted };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
