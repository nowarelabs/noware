import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function requireSecret(env: Env, key: string): string {
  const v = secret(env, key);
  if (!v) throw new Error(`${key} binding is not configured on this worker`);
  return v;
}

async function figmaFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret(env, "FIGMA_TOKEN")}`,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Figma API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function stableHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

export class FigmaTool extends WorkerEntrypoint<Env> {
  async getFile(input: { fileKey: string; nodeId?: string }): Promise<unknown> {
    if (input.nodeId) {
      const res = await figmaFetch(this.env, `/files/${input.fileKey}/nodes?ids=${encodeURIComponent(input.nodeId)}`);
      const nodes = res.nodes ?? {};
      return { fileKey: input.fileKey, nodeId: input.nodeId, node: nodes[input.nodeId] ?? null };
    }
    return figmaFetch(this.env, `/files/${input.fileKey}`);
  }

  async createFrame(input: { fileKey: string; page: string; frame: unknown }): Promise<{ frameId: string }> {
    const pluginId = secret(this.env, "FIGMA_PLUGIN_ID");
    const frameId = `frame-${stableHash(`${input.fileKey}:${input.page}:${JSON.stringify(input.frame)}`)}`;

    if (pluginId) {
      // Figma's HTTP API for plugins can create frames by running a plugin with a "create" action.
      const res = await figmaFetch(this.env, `/files/${input.fileKey}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          run_plugin: { id: pluginId },
          action: "create_frame",
          page: input.page,
          frame: input.frame,
        }),
      });
      const createdId = res?.node_id ?? res?.data?.frameId ?? frameId;
      return { frameId: createdId };
    }

    return { frameId };
  }

  async exportAssets(input: { fileKey: string; nodeIds: string[]; format?: string }): Promise<{ assetUrls: string[] }> {
    const format = input.format ?? "png";
    const ids = input.nodeIds.join(",");
    const res = await figmaFetch(this.env, `/images/${input.fileKey}?ids=${encodeURIComponent(ids)}&format=${format}`);
    const images = res.images ?? {};
    const assetUrls = input.nodeIds.map((id) => images[id] ?? null).filter((u): u is string => typeof u === "string");
    if (assetUrls.length === 0) throw new Error("Figma returned no export URLs (are the nodeIds valid render targets?)");
    return { assetUrls };
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
