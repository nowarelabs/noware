import type { CompanyDescription, CfourModel } from "@nowarelabs/shared";

export interface OrchestratorNode {
  id: string;
  level: "root" | "ss" | "container" | "component";
  elementId: string;
  name: string;
  description: string;
  parentId?: string;
  children: OrchestratorNode[];
}

export class OrchestratorHierarchyFactory {
  build(description: CompanyDescription, model: CfourModel): OrchestratorNode {
    const root: OrchestratorNode = {
      id: `orch-root-${Date.now()}`,
      level: "root",
      elementId: model.id,
      name: description.name,
      description: description.description,
      children: [],
    };

    for (const dept of description.departments) {
      const ssNode: OrchestratorNode = {
        id: `orch-ss-${dept.name.toLowerCase().replace(/\s+/g, "-")}`,
        level: "ss",
        elementId: model.softwareSystems.find((s) => s.name === dept.name)?.id ?? dept.name,
        name: dept.name,
        description: dept.description,
        parentId: root.id,
        children: [],
      };
      root.children.push(ssNode);

      for (const team of dept.teams) {
        const containerNode: OrchestratorNode = {
          id: `orch-container-${team.name.toLowerCase().replace(/\s+/g, "-")}`,
          level: "container",
          elementId: model.containers.find((c) => c.name === team.name)?.id ?? team.name,
          name: team.name,
          description: team.description,
          parentId: ssNode.id,
          children: [],
        };
        ssNode.children.push(containerNode);

        for (const role of team.roles) {
          const componentNode: OrchestratorNode = {
            id: `orch-component-${role.name.toLowerCase().replace(/\s+/g, "-")}`,
            level: "component",
            elementId: model.components.find((c) => c.name === role.name)?.id ?? role.name,
            name: role.name,
            description: role.description,
            parentId: containerNode.id,
            children: [],
          };
          containerNode.children.push(componentNode);
        }
      }
    }

    return root;
  }

  flatten(node: OrchestratorNode): OrchestratorNode[] {
    const result: OrchestratorNode[] = [node];
    for (const child of node.children) {
      result.push(...this.flatten(child));
    }
    return result;
  }

  getNodesAtLevel(root: OrchestratorNode, level: OrchestratorNode["level"]): OrchestratorNode[] {
    return this.flatten(root).filter((n) => n.level === level);
  }
}
