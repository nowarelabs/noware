import type { DatabaseSpec, SystemSpec, KVSpec, R2Spec, DOSpec } from "@nowarelabs/shared";

export interface ProvisionResult {
  id: string;
  type: string;
  endpoint?: string;
  status: string;
}

export class Provisioner {
  private provisioned: Map<string, ProvisionResult> = new Map();

  async provisionDatabase(_spec: DatabaseSpec): Promise<ProvisionResult> {
    const id = `db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result: ProvisionResult = {
      id,
      type: "D1",
      endpoint: `https://${id}.workers.dev`,
      status: "provisioned",
    };
    this.provisioned.set(id, result);
    return result;
  }

  async provisionWorker(spec: SystemSpec): Promise<ProvisionResult> {
    const id = `worker-${spec.name.toLowerCase().replace(/\s+/g, "-")}`;
    const result: ProvisionResult = {
      id,
      type: "Worker",
      endpoint: `https://${id}.workers.dev`,
      status: "deployed",
    };
    this.provisioned.set(id, result);
    return result;
  }

  async provisionKV(_spec: KVSpec): Promise<ProvisionResult> {
    const id = `kv-${Date.now()}`;
    const result: ProvisionResult = { id, type: "KV", status: "provisioned" };
    this.provisioned.set(id, result);
    return result;
  }

  async provisionR2(_spec: R2Spec): Promise<ProvisionResult> {
    const id = `r2-${Date.now()}`;
    const result: ProvisionResult = { id, type: "R2", status: "provisioned" };
    this.provisioned.set(id, result);
    return result;
  }

  async provisionDO(_spec: DOSpec): Promise<ProvisionResult> {
    const id = `do-${Date.now()}`;
    const result: ProvisionResult = { id, type: "DO", status: "provisioned" };
    this.provisioned.set(id, result);
    return result;
  }

  async deprovision(id: string): Promise<void> {
    this.provisioned.delete(id);
  }

  getProvisioned(id: string): ProvisionResult | undefined {
    return this.provisioned.get(id);
  }

  get allProvisioned(): ProvisionResult[] {
    return [...this.provisioned.values()];
  }
}
