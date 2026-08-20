import { describe, expect, test } from "vite-plus/test";
import { CompanyBuilder } from "../src/company-builder";
import { OrchestratorHierarchyFactory } from "../src/orchestrator-hierarchy";

describe("OrchestratorHierarchyFactory", () => {
  test("builds hierarchy from description", () => {
    const factory = new OrchestratorHierarchyFactory();
    const description = {
      name: "TestCo",
      industry: "tech",
      description: "test",
      departments: [
        {
          name: "Engineering",
          description: "eng dept",
          teams: [
            {
              name: "Backend",
              description: "backend team",
              roles: [{ name: "API Dev", description: "build APIs", capabilities: ["coding"] }],
            },
          ],
        },
      ],
    };
    const model = {
      id: "m1",
      name: "TestCo",
      softwareSystems: [{ id: "ss1", name: "Engineering", description: "" }],
      containers: [{ id: "c1", name: "Backend", description: "", parentSystemId: "ss1" }],
      components: [{ id: "comp1", name: "API Dev", description: "", parentContainerId: "c1" }],
      relationships: [],
    };
    const root = factory.build(description, model);
    expect(root.level).toBe("root");
    expect(root.children.length).toBe(1);
    expect(root.children[0].children.length).toBe(1);
    expect(root.children[0].children[0].children.length).toBe(1);
  });

  test("flatten extracts all nodes", () => {
    const factory = new OrchestratorHierarchyFactory();
    const root: OrchestratorNode = {
      id: "root",
      level: "root",
      elementId: "e1",
      name: "Root",
      description: "",
      children: [
        {
          id: "c1",
          level: "ss",
          elementId: "e2",
          name: "C1",
          description: "",
          parentId: "root",
          children: [
            {
              id: "c2",
              level: "container",
              elementId: "e3",
              name: "C2",
              description: "",
              parentId: "c1",
              children: [],
            },
          ],
        },
      ],
    };
    expect(factory.flatten(root).length).toBe(3);
  });

  test("getNodesAtLevel filters correctly", () => {
    const factory = new OrchestratorHierarchyFactory();
    const root: OrchestratorNode = {
      id: "root",
      level: "root",
      elementId: "e1",
      name: "Root",
      description: "",
      children: [
        {
          id: "ss1",
          level: "ss",
          elementId: "e2",
          name: "SS1",
          description: "",
          parentId: "root",
          children: [
            {
              id: "c1",
              level: "container",
              elementId: "e3",
              name: "C1",
              description: "",
              parentId: "ss1",
              children: [],
            },
            {
              id: "c2",
              level: "container",
              elementId: "e4",
              name: "C2",
              description: "",
              parentId: "ss1",
              children: [],
            },
          ],
        },
      ],
    };
    expect(factory.getNodesAtLevel(root, "container").length).toBe(2);
    expect(factory.getNodesAtLevel(root, "ss").length).toBe(1);
  });
});

describe("CompanyBuilder", () => {
  test("builds company from description", async () => {
    const builder = new CompanyBuilder();
    const result = await builder.build(
      "Build a payment company\nDepartment: Engineering\nTeam: Payment Gateway\nRole: API Developer",
    );
    expect(result.status).toBe("deployed");
    expect(result.systems.length).toBe(1);
    expect(result.cfourModelId).toContain("model-");
    expect(result.orchestratorId).toContain("orch-root-");
  });

  test("builds multiple systems", async () => {
    const builder = new CompanyBuilder();
    const result = await builder.build(
      "Build a company\nDepartment: Engineering\nTeam: Payment API\nRole: Gateway\nTeam: Notifications\nRole: Sender",
    );
    expect(result.systems.length).toBe(2);
  });

  test("getSystemCount returns correct count", () => {
    const builder = new CompanyBuilder();
    expect(
      builder.getSystemCount(
        "Build a company\nDepartment: Engineering\nTeam: API\nRole: Dev\nTeam: Notifications\nRole: Sender",
      ),
    ).toBe(2);
  });

  test("getHierarchy returns root node", () => {
    const builder = new CompanyBuilder();
    const root = builder.getHierarchy(
      "Build a company\nDepartment: Engineering\nTeam: API\nRole: Dev",
    );
    expect(root.level).toBe("root");
    expect(root.children.length).toBe(1);
  });
});
