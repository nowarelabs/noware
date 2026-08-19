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

async function sandboxRequest(env: Env, body: unknown): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const base = requireSecret(env, "SANDBOX_API_URL").replace(/\/$/, "");
  const key = secret(env, "SANDBOX_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/exec`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`sandbox API ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text || "{}");
  return {
    stdout: String(data.stdout ?? ""),
    stderr: String(data.stderr ?? ""),
    exitCode: typeof data.exitCode === "number" ? data.exitCode : 0,
  };
}

export class SandboxExecTool extends WorkerEntrypoint<Env> {
  async runCommand(input: { command: string; cwd?: string; env?: unknown }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!secret(this.env, "SANDBOX_API_URL")) {
      throw new Error("SANDBOX_API_URL is not configured on this worker; point it at a sandboxed exec service (e.g. E2B, Modal, or your own runner)");
    }
    return sandboxRequest(this.env, { command: input.command, cwd: input.cwd, env: input.env });
  }

  async runInSandbox(input: { task: string; files?: unknown }): Promise<{ result: unknown }> {
    if (!secret(this.env, "SANDBOX_API_URL")) {
      throw new Error("SANDBOX_API_URL is not configured on this worker; point it at a sandboxed exec service");
    }
    const base = requireSecret(this.env, "SANDBOX_API_URL").replace(/\/$/, "");
    const key = secret(this.env, "SANDBOX_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${base}/run`, { method: "POST", headers, body: JSON.stringify({ task: input.task, files: input.files }) });
    const text = await res.text();
    if (!res.ok) throw new Error(`sandbox API ${res.status}: ${text.slice(0, 300)}`);
    return { result: text ? JSON.parse(text) : null };
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
