import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface Flag {
  key: string;
  description?: string;
  defaultValue: boolean;
  enabled: boolean;
  rollout: number;
  scopes: Map<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

const flags = new Map<string, Flag>();

export class FeatureFlagsTool extends WorkerEntrypoint<Env> {
  async createFlag(input: { key: string; description?: string; defaultValue?: boolean }): Promise<{ flagKey: string }> {
    if (flags.has(input.key)) throw new Error(`flag "${input.key}" already exists`);
    const defaultValue = input.defaultValue ?? false;
    flags.set(input.key, {
      key: input.key,
      description: input.description,
      defaultValue,
      enabled: defaultValue,
      rollout: defaultValue ? 100 : 0,
      scopes: new Map(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { flagKey: input.key };
  }

  async toggleFlag(input: { flagKey: string; enabled: boolean; scope?: string }): Promise<{ flagKey: string; enabled: boolean }> {
    const flag = flags.get(input.flagKey);
    if (!flag) throw new Error(`flag "${input.flagKey}" not found; create it first`);

    if (input.scope) {
      flag.scopes.set(input.scope, input.enabled);
    } else {
      flag.enabled = input.enabled;
      flag.rollout = input.enabled ? 100 : 0;
    }
    flag.updatedAt = new Date().toISOString();
    return { flagKey: input.flagKey, enabled: input.enabled };
  }

  async getRolloutStatus(input: { flagKey: string }): Promise<unknown> {
    const flag = flags.get(input.flagKey);
    if (!flag) throw new Error(`flag "${input.flagKey}" not found`);

    const scopes = [...flag.scopes.entries()].map(([scope, enabled]) => ({ scope, enabled }));
    const enabledScopes = scopes.filter((s) => s.enabled).length;
    return {
      flagKey: flag.key,
      description: flag.description,
      enabled: flag.enabled,
      defaultValue: flag.defaultValue,
      rolloutPercentage: flag.rollout,
      scopes,
      scopeCoverage: scopes.length > 0 ? Math.round((enabledScopes / scopes.length) * 1000) / 10 : null,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    };
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
