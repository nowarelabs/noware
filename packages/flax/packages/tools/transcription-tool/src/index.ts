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

const ACTION_VERBS = /\b(add|fix|update|remove|create|send|call|schedule|review|approve|build|deploy|implement|refactor|document|investigate|follow up|follow-up|reach out|test|confirm|decide|share|prepare|file|submit|report|contact|email|notify)\b/gi;

export class TranscriptionTool extends WorkerEntrypoint<Env> {
  async transcribeAudio(input: { audioUrl: string; language?: string }): Promise<{ text: string }> {
    const ai = this.env.AI as AiBinding | undefined;
    if (ai) {
      const audioRes = await fetch(input.audioUrl, { signal: AbortSignal.timeout(60000) });
      if (!audioRes.ok) throw new Error(`could not download audio (HTTP ${audioRes.status})`);
      const audio = await audioRes.arrayBuffer();
      const inputs: Record<string, unknown> = { audio };
      if (input.language) inputs.language = input.language;
      const result = await ai.run("@cf/openai/whisper", inputs);
      const text = result?.text ?? result?.output?.text;
      if (typeof text !== "string" || text.length === 0) throw new Error("transcription returned empty text");
      return { text };
    }

    const apiUrl = secret(this.env, "TRANSCRIPTION_API_URL");
    if (apiUrl) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = secret(this.env, "TRANSCRIPTION_API_KEY");
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ audio_url: input.audioUrl, language: input.language }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`transcription API ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text || "{}");
      const transcript = data.text ?? data.transcript ?? data.result?.text;
      if (typeof transcript !== "string" || transcript.length === 0) throw new Error("transcription API returned empty text");
      return { text: transcript };
    }

    throw new Error("no transcription provider configured (add an AI binding or TRANSCRIPTION_API_URL)");
  }

  async summarizeCall(input: { transcript?: string; audioUrl?: string }): Promise<{ summary: string; actionItems?: string[] }> {
    let transcript = input.transcript ?? "";
    if (!transcript && input.audioUrl) {
      ({ text: transcript } = await this.transcribeAudio({ audioUrl: input.audioUrl }));
    }
    if (!transcript) throw new Error("provide a transcript or an audioUrl to summarize");

    const ai = this.env.AI as AiBinding | undefined;
    if (ai) {
      try {
        const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
          prompt: `You are a meeting summarizer. Given this call transcript, produce a concise summary and a bullet list of action items.\n\nTranscript:\n${transcript.slice(0, 8000)}\n\nRespond in JSON: {"summary": "...", "actionItems": ["..."]}`,
          max_tokens: 512,
        });
        const raw = result?.response ?? "";
        const jsonMatch = /(\{[\s\S]*\})/.exec(raw);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            return { summary: parsed.summary ?? "", actionItems: parsed.actionItems ?? [] };
          } catch {
            // fall through to heuristic
          }
        }
      } catch {
        // fall through to heuristic
      }
    }

    const sentences = transcript.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const summary = [
      `Call summary based on ${sentences.length} sentences:`,
      sentences.slice(0, 2).join(" "),
      `Speakers/segments: ${sentences.length}`,
    ].join(" ");

    const actionItems = [...transcript.matchAll(ACTION_VERBS)].map((m) => m[0]).slice(0, 10);
    return { summary, actionItems };
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
