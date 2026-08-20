import type { CompanyResult, SystemBuildResult, SystemSpec } from "@nowarelabs/shared";
import { CompanyParser, CfourModelGenerator } from "@nowarelabs/company-parser";
import { SystemBuilder, selectTemplate } from "@nowarelabs/system-builder";
import { OrchestratorHierarchyFactory } from "./orchestrator-hierarchy";

export class CompanyBuilder {
  private parser: CompanyParser;
  private cfourGenerator: CfourModelGenerator;
  private systemBuilder: SystemBuilder;
  private hierarchyFactory: OrchestratorHierarchyFactory;

  constructor() {
    this.parser = new CompanyParser();
    this.cfourGenerator = new CfourModelGenerator();
    this.systemBuilder = new SystemBuilder();
    this.hierarchyFactory = new OrchestratorHierarchyFactory();
  }

  async build(description: string): Promise<CompanyResult> {
    const parsed = this.parser.parse(description);
    const model = this.cfourGenerator.generate(parsed);
    const hierarchy = this.hierarchyFactory.build(parsed, model);

    const systems: SystemBuildResult[] = [];
    const containers = this.hierarchyFactory.getNodesAtLevel(hierarchy, "container");

    for (const container of containers) {
      const template = selectTemplate(container.description || container.name);
      const spec: SystemSpec = {
        id: container.id,
        name: template.name,
        type: "worker",
        cfourElementId: container.elementId,
        parentContainerId: container.parentId ?? "",
        config: {},
        database: template.database,
        bindings: template.bindings,
        integrations: template.integrations,
      };

      const result = await this.systemBuilder.build(spec, template.codeTemplate);
      systems.push(result);
    }

    return {
      cfourModelId: model.id,
      orchestratorId: hierarchy.id,
      systems,
      status: "deployed",
    };
  }

  getHierarchy(description: string) {
    const parsed = this.parser.parse(description);
    const model = this.cfourGenerator.generate(parsed);
    return this.hierarchyFactory.build(parsed, model);
  }

  getSystemCount(description: string): number {
    const hierarchy = this.getHierarchy(description);
    return this.hierarchyFactory.getNodesAtLevel(hierarchy, "container").length;
  }
}
