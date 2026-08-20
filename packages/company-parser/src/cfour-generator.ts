import type { CompanyDescription } from "@nowarelabs/shared";

export interface CfourModel {
  id: string;
  name: string;
  softwareSystems: Array<{ id: string; name: string; description: string }>;
  containers: Array<{ id: string; name: string; description: string; parentSystemId: string }>;
  components: Array<{ id: string; name: string; description: string; parentContainerId: string }>;
  relationships: Array<{ id: string; sourceId: string; targetId: string; label: string }>;
}

export class CfourModelGenerator {
  generate(description: CompanyDescription): CfourModel {
    const modelId = `model-${Date.now()}`;
    const softwareSystems: CfourModel["softwareSystems"] = [];
    const containers: CfourModel["containers"] = [];
    const components: CfourModel["components"] = [];
    const relationships: CfourModel["relationships"] = [];

    for (const dept of description.departments) {
      const ssId = `ss-${dept.name.toLowerCase().replace(/\s+/g, "-")}`;
      softwareSystems.push({ id: ssId, name: dept.name, description: dept.description });

      for (const team of dept.teams) {
        const containerId = `container-${team.name.toLowerCase().replace(/\s+/g, "-")}`;
        containers.push({
          id: containerId,
          name: team.name,
          description: team.description,
          parentSystemId: ssId,
        });
        relationships.push({
          id: `rel-${ssId}-${containerId}`,
          sourceId: ssId,
          targetId: containerId,
          label: "contains",
        });

        for (const role of team.roles) {
          const componentId = `component-${role.name.toLowerCase().replace(/\s+/g, "-")}`;
          components.push({
            id: componentId,
            name: role.name,
            description: role.description,
            parentContainerId: containerId,
          });
          relationships.push({
            id: `rel-${containerId}-${componentId}`,
            sourceId: containerId,
            targetId: componentId,
            label: "contains",
          });
        }
      }
    }

    return {
      id: modelId,
      name: description.name,
      softwareSystems,
      containers,
      components,
      relationships,
    };
  }
}
