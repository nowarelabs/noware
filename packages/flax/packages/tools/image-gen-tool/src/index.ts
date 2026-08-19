import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<any>;
}

function secret(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parseSize(size?: string): { width: number; height: number } {
  if (!size) return { width: 1024, height: 1024 };
  const m = /^(\d+)x(\d+)$/.exec(size);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1024, height: 1024 };
}

export class ImageGenTool extends WorkerEntrypoint<Env> {
  async generateImage(input: { prompt: string; size?: string; negativePrompt?: string }): Promise<{ imageUrl: string }> {
    const ai = this.env.AI as AiBinding | undefined;
    const { width, height } = parseSize(input.size);

    if (ai) {
      const result = await ai.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        width,
        height,
        num_steps: 4,
      });
      const image: unknown = result?.image ?? result?.output;
      if (typeof image === "string") {
        return { imageUrl: `data:image/png;base64,${image}` };
      }
      if (image instanceof ArrayBuffer) {
        const b64 = arrayBufferToBase64(image);
        return { imageUrl: `data:image/png;base64,${b64}` };
      }
      throw new Error("AI image generation returned an unexpected payload");
    }

    const apiUrl = secret(this.env, "IMAGE_GEN_API_URL");
    if (apiUrl) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = secret(this.env, "IMAGE_GEN_API_KEY");
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: input.prompt, negative_prompt: input.negativePrompt, width, height }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`image generation API ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text || "{}");
      const imageUrl = data.image_url ?? data.url ?? data.output?.url ?? data.data?.[0]?.url;
      if (!imageUrl) throw new Error("image generation API returned no image url");
      return { imageUrl };
    }

    throw new Error("no image generation provider configured (add an AI binding or IMAGE_GEN_API_URL)");
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
