import type { BindingSpec, DeploymentStatus } from "@nowarelabs/shared";

export class Deployer {
  private deployments: Map<string, DeploymentStatus> = new Map();

  async deploy(
    workerName: string,
    _code: string,
    _bindings: BindingSpec[],
  ): Promise<{ url: string; status: string }> {
    const url = `https://${workerName}.workers.dev`;
    const status: DeploymentStatus = {
      workerName,
      version: `v-${Date.now()}`,
      status: "deployed",
      url,
      deployedAt: Date.now(),
    };
    this.deployments.set(workerName, status);
    return { url, status: "deployed" };
  }

  async rollback(workerName: string, version: string): Promise<void> {
    const existing = this.deployments.get(workerName);
    if (existing) {
      existing.version = version;
      existing.status = "rolled-back";
    }
  }

  async getDeploymentStatus(workerName: string): Promise<DeploymentStatus | undefined> {
    return this.deployments.get(workerName);
  }

  get allDeployments(): DeploymentStatus[] {
    return [...this.deployments.values()];
  }
}
