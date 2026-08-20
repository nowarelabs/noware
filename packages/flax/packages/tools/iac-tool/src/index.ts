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

async function tfcFetch(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const base = (secret(env, "TFE_BASE_URL") ?? "https://app.terraform.io/api/v2").replace(
    /\/$/,
    "",
  );
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret(env, "TFE_TOKEN")}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
      ...(init.headers as Record<string, string>),
    },
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(`Terraform Cloud API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function workspaceId(env: Env, stackDir: string): Promise<string> {
  const org = requireSecret(env, "TFE_ORG");
  const name = secret(env, "TFE_WORKSPACE") ?? stackDir.split("/").pop() ?? stackDir;
  const res = await tfcFetch(env, `/organizations/${org}/workspaces/${encodeURIComponent(name)}`);
  if (!res.data?.id) throw new Error(`workspace "${name}" not found in org ${org}`);
  return res.data.id;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function applyVars(env: Env, workspaceIdValue: string, vars?: unknown): Promise<void> {
  if (!vars || typeof vars !== "object") return;
  for (const [key, value] of Object.entries(vars as Record<string, unknown>)) {
    await tfcFetch(env, `/workspaces/${workspaceIdValue}/vars`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "vars",
          attributes: {
            key,
            value: String(value),
            category: "terraform",
            sensitive: /(token|secret|key|password)/i.test(key),
          },
        },
      }),
    });
  }
}

function planSummary(plan: any): unknown {
  const attrs = plan?.attributes ?? {};
  return {
    status: attrs.status ?? null,
    resourceAdditions: attrs["resource-additions"] ?? null,
    resourceChanges: attrs["resource-changes"] ?? null,
    resourceDestructions: attrs["resource-destructions"] ?? null,
    resourceImports: attrs["resource-imports"] ?? null,
    statusTimestamps: attrs["status-timestamps"] ?? null,
  };
}

function stableHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const localStacks = new Map<
  string,
  { planCount: number; applied: boolean; outputs: Record<string, string>; serial: number }
>();

export class IacTool extends WorkerEntrypoint<Env> {
  async planTerraform(input: {
    stackDir: string;
    vars?: unknown;
  }): Promise<{ planSummary: unknown }> {
    const tfeToken = secret(this.env, "TFE_TOKEN");
    if (tfeToken) {
      const wsId = await workspaceId(this.env, input.stackDir);
      await applyVars(this.env, wsId, input.vars);
      const run = await tfcFetch(this.env, "/runs", {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "runs",
            attributes: { "is-destroy": false, message: `plan for ${input.stackDir}` },
            relationships: { workspace: { data: { type: "workspaces", id: wsId } } },
          },
        }),
      });
      const runId = run.data.id;
      let status = "pending";
      for (let i = 0; i < 40; i++) {
        const current = await tfcFetch(this.env, `/runs/${runId}`);
        status = current.data.attributes.status;
        if (["planned", "errored", "canceled", "cost_estimated"].includes(status)) break;
        await sleep(1500);
      }
      const final = await tfcFetch(this.env, `/runs/${runId}`);
      const planId = final.data.relationships.plan?.data?.id;
      const plan = planId ? await tfcFetch(this.env, `/plans/${planId}`) : null;
      if (status === "errored") throw new Error(`terraform plan errored for ${input.stackDir}`);
      return { planSummary: { runId, status, ...(planSummary(plan) as Record<string, unknown>) } };
    }

    const key = input.stackDir;
    const state = localStacks.get(key) ?? { planCount: 0, applied: false, outputs: {}, serial: 0 };
    state.planCount += 1;
    localStacks.set(key, state);
    const resources = Object.keys(input.vars ?? {}).length + 2;
    return {
      planSummary: {
        runId: `local-${stableHash(key)}-${state.planCount}`,
        status: "planned",
        resourceAdditions: resources,
        resourceChanges: Math.max(0, resources - 1),
        resourceDestructions: 0,
        note: "local simulation (TFE_TOKEN not configured)",
      },
    };
  }

  async applyTerraform(input: {
    stackDir: string;
    vars?: unknown;
    autoApprove?: boolean;
  }): Promise<{ outputs: unknown }> {
    const tfeToken = secret(this.env, "TFE_TOKEN");
    if (tfeToken) {
      const wsId = await workspaceId(this.env, input.stackDir);
      await applyVars(this.env, wsId, input.vars);
      const run = await tfcFetch(this.env, "/runs", {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "runs",
            attributes: {
              "is-destroy": false,
              "auto-apply": input.autoApprove === true,
              message: `apply for ${input.stackDir}`,
            },
            relationships: { workspace: { data: { type: "workspaces", id: wsId } } },
          },
        }),
      });
      const runId = run.data.id;
      let status = "pending";
      for (let i = 0; i < 60; i++) {
        const current = await tfcFetch(this.env, `/runs/${runId}`);
        status = current.data.attributes.status;
        if (["planned", "errored", "canceled"].includes(status)) {
          if (status === "planned" && input.autoApprove !== true) {
            await tfcFetch(this.env, `/runs/${runId}/actions/apply`, {
              method: "POST",
              body: "{}",
            });
          }
        }
        if (["applied", "errored", "canceled"].includes(status)) break;
        await sleep(2000);
      }
      if (status === "errored") throw new Error(`terraform apply errored for ${input.stackDir}`);
      const stateVersion = await tfcFetch(this.env, `/workspaces/${wsId}/current-state-version`);
      const outputs = stateVersion.data?.attributes?.outputs ?? {};
      return { outputs };
    }

    const key = input.stackDir;
    const state = localStacks.get(key) ?? { planCount: 0, applied: false, outputs: {}, serial: 0 };
    state.applied = true;
    state.serial += 1;
    state.outputs = Object.fromEntries(
      Object.entries(input.vars ?? {}).map(([k, v]) => [k, `value from apply (${String(v)})`]),
    );
    localStacks.set(key, state);
    return { outputs: state.outputs };
  }

  async getState(input: { stackDir: string }): Promise<unknown> {
    const tfeToken = secret(this.env, "TFE_TOKEN");
    if (tfeToken) {
      const wsId = await workspaceId(this.env, input.stackDir);
      const version = await tfcFetch(this.env, `/workspaces/${wsId}/current-state-version`);
      const data = version.data ?? null;
      return data
        ? {
            stackDir: input.stackDir,
            serial: data.attributes?.serial ?? null,
            createdAt: data.attributes?.["created-at"] ?? null,
            stateDownloadUrl: data.attributes?.["hosted-state-download-url"] ?? null,
            outputs: data.attributes?.outputs ?? null,
          }
        : { stackDir: input.stackDir, serial: 0, message: "no state version yet" };
    }

    const state = localStacks.get(input.stackDir);
    if (!state) return { stackDir: input.stackDir, serial: 0, outputs: {}, applied: false };
    return {
      stackDir: input.stackDir,
      serial: state.serial,
      outputs: state.outputs,
      applied: state.applied,
      planCount: state.planCount,
    };
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("This worker is only callable via RPC service binding.", { status: 400 });
  },
};
