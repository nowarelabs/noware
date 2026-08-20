import type { SystemSpec, SystemBuildResult } from "@nowarelabs/shared";
import { Provisioner } from "./provisioner";
import { Deployer } from "./deployer";
import { ConfigGenerator } from "./config-generator";

export class SystemBuilder {
  private provisioner: Provisioner;
  private deployer: Deployer;
  private configGenerator: ConfigGenerator;

  constructor() {
    this.provisioner = new Provisioner();
    this.deployer = new Deployer();
    this.configGenerator = new ConfigGenerator();
  }

  async build(spec: SystemSpec, code: string): Promise<SystemBuildResult> {
    let databaseId = "";

    if (spec.database) {
      const dbResult = await this.provisioner.provisionDatabase(spec.database);
      databaseId = dbResult.id;
    }

    for (const binding of spec.bindings) {
      if (binding.type === "KV") {
        await this.provisioner.provisionKV({ name: binding.name });
      } else if (binding.type === "R2") {
        await this.provisioner.provisionR2({ name: binding.name });
      } else if (binding.type === "DO") {
        await this.provisioner.provisionDO({ name: binding.name, className: binding.resource });
      }
    }

    const config = this.configGenerator.generate(spec);
    const { url } = await this.deployer.deploy(
      spec.name.toLowerCase().replace(/\s+/g, "-"),
      code + "\n\n// Config:\n" + config,
      spec.bindings,
    );

    return {
      systemId: spec.id,
      workerUrl: url,
      databaseId,
      status: "deployed",
    };
  }

  get provisioner_() {
    return this.provisioner;
  }
  get deployer_() {
    return this.deployer;
  }
  get configGenerator_() {
    return this.configGenerator;
  }
}
