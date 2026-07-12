import { describe, expect, test, beforeEach } from "vite-plus/test";
import type { CfourContext } from "@nowarelabs/shared";
import {
  BaseCfour,
  flattenWorkspace,
  c4ToReactFlow,
  buildSystemContextView,
  buildContainerView,
  buildComponentView,
  buildCodeView,
  type C4Workspace,
} from "../src/index.ts";

// ----------------------------------------------------------------
// Mock Data
// ----------------------------------------------------------------

const mockWorkspace: C4Workspace = {
  name: "Test Workspace",
  description: "A test workspace for C4 model",
  people: [
    { id: "p1", name: "User", kind: "Person", description: "A regular user" },
    { id: "p2", name: "Admin", kind: "Person", description: "An admin user", external: true },
  ],
  softwareSystems: [
    {
      id: "sys1",
      name: "Main System",
      kind: "SoftwareSystem",
      description: "The primary system",
      containers: [
        {
          id: "con1",
          name: "Web App",
          kind: "Container",
          systemId: "sys1",
          technology: "React",
          components: [
            {
              id: "comp1",
              name: "Dashboard",
              kind: "Component",
              containerId: "con1",
              technology: "React Component",
              codeElements: [
                {
                  id: "code1",
                  name: "DashboardView",
                  kind: "Class",
                  componentId: "comp1",
                  technology: "TypeScript",
                  members: [{ name: "render", kind: "method", visibility: "public" }],
                },
              ],
            },
          ],
        },
        {
          id: "con2",
          name: "API",
          kind: "Container",
          systemId: "sys1",
          technology: "Node.js",
        },
      ],
    },
    {
      id: "sys2",
      name: "External System",
      kind: "SoftwareSystem",
      external: true,
    },
  ],
  relationships: [
    { id: "r1", kind: "Relationship", sourceId: "p1", destinationId: "sys1", description: "Uses" },
    {
      id: "r2",
      kind: "Relationship",
      sourceId: "sys1",
      destinationId: "sys2",
      description: "Fetches data from",
    },
    {
      id: "r3",
      kind: "Relationship",
      sourceId: "con1",
      destinationId: "con2",
      description: "Calls API",
      interactionStyle: "sync",
    },
    {
      id: "r4",
      kind: "Relationship",
      sourceId: "code1",
      destinationId: "comp1",
      description: "Part of",
    },
  ],
};

describe("C4 Model - cfour package", () => {
  beforeEach(() => {
    BaseCfour.resetWorkspace(); // Resets "default"
    // Clear other workspaces if any
    BaseCfour.getWorkspaceNames().forEach((name) => {
      if (name !== "default") BaseCfour.resetWorkspace(name);
    });
  });

  describe("BaseCfour", () => {
    class TestQuery extends BaseCfour {}

    test("constructor accepts request, env, ctx", () => {
      const mockRequest = new Request("http://localhost");
      const mockEnv = { DB: {} } as Record<string, unknown>;
      const mockCtx = {
        waitUntil: () => {},
        passThroughOnException: () => {},
      } as CfourContext;

      const query = new TestQuery(mockRequest, mockEnv, mockCtx);

      expect(query).toBeDefined();
      expect((query as any).request).toBe(mockRequest);
      expect((query as any).env).toBe(mockEnv);
    });

    test("static hooks exist", () => {
      expect(BaseCfour.beforeHooks).toBeDefined();
      expect(BaseCfour.afterHooks).toBeDefined();
    });
  });

  describe("BaseCfour Composition", () => {
    test("should compose a full workspace using static methods", () => {
      BaseCfour.resetWorkspace("default", "Framework Architecture");

      BaseCfour.addSoftwareSystem({ id: "sys-main", name: "Main System" });
      BaseCfour.addContainer({ id: "con-web", name: "Web App", systemId: "sys-main" });
      BaseCfour.addComponent({ id: "comp-auth", name: "Auth", containerId: "con-web" });
      BaseCfour.addCodeElement({ id: "class-user", name: "User", componentId: "comp-auth" });
      BaseCfour.addRelationship({
        id: "rel-1",
        kind: "Relationship",
        sourceId: "class-user",
        destinationId: "comp-auth",
      });

      const ws = BaseCfour.getWorkspace();
      expect(ws.name).toBe("Framework Architecture");
      expect(ws.softwareSystems[0].containers![0].components![0].codeElements![0].name).toBe(
        "User",
      );
      expect(ws.relationships.length).toBe(1);
    });

    test("addBuildingBlock should create a framework system and containers", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addBuildingBlock("pkg-auth", "Authentication", "Handles login", "TypeScript");

      const ws = BaseCfour.getWorkspace();
      const framework = ws.softwareSystems.find((s) => s.id === "framework");
      expect(framework).toBeDefined();
      expect(framework?.containers![0].id).toBe("pkg-auth");
    });

    test("packages can register themselves as building blocks via static initialization", () => {
      BaseCfour.resetWorkspace();

      // Simulate 'adapters' package registration
      // @ts-ignore - static blocks are supported in modern TS/JS
      class AdaptersPackage extends BaseCfour {
        static {
          this.addBuildingBlock(
            "pkg-adapters",
            "Adapters",
            "Infrastructure adapters",
            "TypeScript",
          );
        }
      }

      // Simulate 'domains' package registration
      // @ts-ignore
      class DomainsPackage extends BaseCfour {
        static {
          this.addBuildingBlock("pkg-domains", "Domains", "Domain logic", "TypeScript");
        }
      }

      const ws = BaseCfour.getWorkspace();
      const framework = ws.softwareSystems.find((s) => s.id === "framework");

      expect(framework).toBeDefined();
      expect(framework?.containers?.length).toBe(2);
      const containerIds = framework?.containers?.map((c) => c.id);
      expect(containerIds).toContain("pkg-adapters");
      expect(containerIds).toContain("pkg-domains");
    });

    test("should support easy auto-registration via static register method", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addBuildingBlock("pkg-web", "Web", "Frontend", "React");

      class LoginService extends BaseCfour {
        static {
          this.register({
            parentId: "pkg-web",
            description: "Handles user login",
            technology: "JWT",
          });
        }
      }

      const ws = BaseCfour.getWorkspace();
      const component = ws.softwareSystems[0].containers![0].components![0];
      expect(component.id).toBe("LoginService"); // inferred from class name
      expect(component.description).toBe("Handles user login");
    });

    test("should avoid duplicate container registration", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addBuildingBlock("pkg-dup", "Duplicate", "Desc", "Tech");
      BaseCfour.addBuildingBlock("pkg-dup", "Duplicate", "Desc", "Tech");

      const ws = BaseCfour.getWorkspace();
      const framework = ws.softwareSystems.find((s) => s.id === "framework");
      expect(framework?.containers?.length).toBe(1);
    });

    test("should throw error when parent is missing", () => {
      BaseCfour.resetWorkspace();
      expect(() => BaseCfour.addContainer({ id: "c1", name: "C1", systemId: "missing" })).toThrow(
        /Software System with id "missing" not found/,
      );
    });

    test("should support drilling by providing childCount and canDrill metadata", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "System 1" });
      BaseCfour.addContainer({ id: "con1", name: "Container 1", systemId: "sys1" });

      const ws = BaseCfour.getWorkspace();
      const { nodes } = c4ToReactFlow(ws);

      const sysNode = nodes.find((n) => n.id === "sys1");
      expect(sysNode?.data.childCount).toBe(1);
      expect(sysNode?.data.canDrill).toBe(true);

      const personNode = nodes.find((n) => n.data.kind === "Person"); // Person has no children
      if (personNode) {
        expect(personNode.data.canDrill).toBe(false);
      }
    });

    test("should provide static view builders that use global workspace", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "System 1" });
      BaseCfour.addContainer({ id: "con1", name: "Container 1", systemId: "sys1" });

      const view = BaseCfour.getContainerView("sys1");
      expect(view.kind).toBe("Container");
      expect(view.elements.map((e) => e.elementId)).toContain("con1");
    });

    test("should support multiple independent workspaces", () => {
      // Setup Workspace A
      BaseCfour.resetWorkspace("WorkspaceA", "Architecture A");
      BaseCfour.addSoftwareSystem({ id: "sysA", name: "System A" }, "WorkspaceA");

      // Setup Workspace B
      BaseCfour.resetWorkspace("WorkspaceB", "Architecture B");
      BaseCfour.addSoftwareSystem({ id: "sysB", name: "System B" }, "WorkspaceB");

      const wsA = BaseCfour.getWorkspace("WorkspaceA");
      const wsB = BaseCfour.getWorkspace("WorkspaceB");

      expect(wsA.name).toBe("Architecture A");
      expect(wsB.name).toBe("Architecture B");

      expect(wsA.softwareSystems.map((s) => s.id)).toContain("sysA");
      expect(wsA.softwareSystems.map((s) => s.id)).not.toContain("sysB");

      expect(wsB.softwareSystems.map((s) => s.id)).toContain("sysB");
      expect(wsB.softwareSystems.map((s) => s.id)).not.toContain("sysA");
    });

    test("register should target specific workspace", () => {
      BaseCfour.resetWorkspace("SpecificWS");
      BaseCfour.addBuildingBlock("pkg-web", "Web", "Frontend", "React", "SpecificWS");

      class CustomService extends BaseCfour {
        static {
          this.register({
            parentId: "pkg-web",
            workspaceName: "SpecificWS",
            description: "Custom service in specific workspace",
          });
        }
      }

      const ws = BaseCfour.getWorkspace("SpecificWS");
      const component = ws.softwareSystems[0].containers![0].components![0];
      expect(component.id).toBe("CustomService");

      const defaultWs = BaseCfour.getWorkspace("default");
      expect(defaultWs.softwareSystems.length).toBe(0);
    });

    test("should support interactive editing (update and remove)", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Original" });

      // Update
      BaseCfour.updateElement("sys1", { name: "Updated" });
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("Updated");

      // Remove
      BaseCfour.removeElement("sys1");
      expect(BaseCfour.getWorkspace().softwareSystems.length).toBe(0);
    });

    test("should support view persistence and position updates", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });

      const view = BaseCfour.getSystemContextView("sys1");
      BaseCfour.saveView(view);

      BaseCfour.updateViewPosition(view.id, "sys1", 100, 200);

      const savedView = BaseCfour.getWorkspace().views![0];
      const element = savedView.elements.find((e) => e.elementId === "sys1");
      expect(element?.x).toBe(100);
      expect(element?.y).toBe(200);
    });

    test("should notify subscribers on change", () => {
      BaseCfour.resetWorkspace();
      let notified = false;
      const unsubscribe = BaseCfour.subscribe((name) => {
        if (name === "default") notified = true;
      });

      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      expect(notified).toBe(true);

      unsubscribe();
      notified = false;
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      expect(notified).toBe(false);
    });

    test("should support export and import for persistence", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Persistent System" });

      const json = BaseCfour.export();
      expect(json).toContain("Persistent System");

      BaseCfour.resetWorkspace(); // Clear
      BaseCfour.import(json);
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("Persistent System");
    });

    test("should support querying nodes", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Web App", tags: ["frontend"] });
      BaseCfour.addBuildingBlock("api", "API", "Backend", "Node.js");

      const webNodes = BaseCfour.findNodes({ search: "Web" });
      expect(webNodes.length).toBe(1);
      expect(webNodes[0].id).toBe("sys1");

      const nodeJsNodes = BaseCfour.findNodes({ technology: "Node.js" });
      expect(nodeJsNodes.length).toBe(1);
      expect(nodeJsNodes[0].id).toBe("api");

      const taggedNodes = BaseCfour.findNodes({ tags: ["frontend"] });
      expect(taggedNodes.length).toBe(1);
      expect(taggedNodes[0].id).toBe("sys1");

      const teamNodes = BaseCfour.findNodes({ owner: "Team A" });
      // In register test we might have some, but let's assume none for now or add one
      BaseCfour.addSoftwareSystem({ id: "sys-team", name: "Team Sys", owner: "Team A" });
      expect(BaseCfour.findNodes({ owner: "Team A" }).length).toBe(1);
    });

    test("should support team-based perspectives", () => {
      BaseCfour.resetWorkspace();

      // Team Alpha owns these
      BaseCfour.addSoftwareSystem({ id: "svc-1", name: "Service 1", owner: "Team Alpha" });
      BaseCfour.addSoftwareSystem({ id: "svc-2", name: "Service 2", owner: "Team Alpha" });

      // Team Beta owns this
      BaseCfour.addSoftwareSystem({ id: "svc-3", name: "Service 3", owner: "Team Beta" });

      // Interaction
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "svc-1",
        destinationId: "svc-3",
        description: "Calls",
      });

      const view = BaseCfour.getTeamView("Team Alpha");

      const elementIds = view.elements.map((e) => e.elementId);
      expect(elementIds).toContain("svc-1"); // Owned
      expect(elementIds).toContain("svc-2"); // Owned
      expect(elementIds).toContain("svc-3"); // Neighbor (dependency)

      expect(view.relationships.map((r) => r.relationshipId)).toContain("r1");
    });

    test("should support ephemeral flow views and catalogs for CISO/Stakeholders", () => {
      BaseCfour.resetWorkspace();

      BaseCfour.addSoftwareSystem({ id: "internet", name: "Internet", external: true });
      BaseCfour.addBuildingBlock("gateway", "API Gateway", "Entry point", "Nginx");
      BaseCfour.addBuildingBlock("db", "Database", "Sensitive data", "PostgreSQL");

      // Network flows
      BaseCfour.addRelationship({
        id: "f1",
        kind: "Relationship",
        sourceId: "internet",
        destinationId: "gateway",
        description: "Inbound traffic",
        technology: "HTTPS/443",
        tags: ["internet-flow", "security-critical"],
      });

      BaseCfour.addRelationship({
        id: "f2",
        kind: "Relationship",
        sourceId: "gateway",
        destinationId: "db",
        description: "Database access",
        technology: "SQL/5432",
        tags: ["internal-flow"],
      });

      // 1. Get the View for the CISO presentation
      const flowView = BaseCfour.getFlowView("internet-flow", "CISO: Internet Facing Flows");
      expect(flowView.title).toBe("CISO: Internet Facing Flows");
      expect(flowView.elements.map((e) => e.elementId)).toContain("internet");
      expect(flowView.elements.map((e) => e.elementId)).toContain("gateway");
      expect(flowView.elements.map((e) => e.elementId)).not.toContain("db"); // Internal, not tagged

      // 2. Get the Tabular Catalog for the audit report
      const catalog = BaseCfour.getFlowCatalog("internet-flow");
      expect(catalog.length).toBe(1);
      expect(catalog[0].source).toBe("Internet");
      expect(catalog[0].technology).toBe("HTTPS/443");
    });

    test("should support custom icons for elements", () => {
      BaseCfour.resetWorkspace();

      BaseCfour.addSoftwareSystem({
        id: "db",
        name: "Database",
        icon: "lucide:database",
      });

      const ws = BaseCfour.getWorkspace();
      const { nodes } = c4ToReactFlow(ws);

      expect(nodes[0].data.icon).toBe("lucide:database");

      // Verify legend also includes the icon
      const view = BaseCfour.getSystemContextView("db");
      const legend = BaseCfour.getLegend(view);
      expect(legend.elements[0].icon).toBe("lucide:database");
    });

    test("should support automatic relationship roll-up (the 'Better General Case')", () => {
      BaseCfour.resetWorkspace();

      // System A with Container A
      BaseCfour.addSoftwareSystem({ id: "sysA", name: "System A" });
      BaseCfour.addContainer({ id: "conA", name: "Container A", systemId: "sysA" });

      // System B with Container B
      BaseCfour.addSoftwareSystem({ id: "sysB", name: "System B" });
      BaseCfour.addContainer({ id: "conB", name: "Container B", systemId: "sysB" });

      // Relationship at the GRANULAR level (Container to Container)
      BaseCfour.addRelationship({
        id: "rel-deep",
        kind: "Relationship",
        sourceId: "conA",
        destinationId: "conB",
        description: "Sends data",
      });

      // 1. Verify Level 1 View (System Context)
      // It should automatically show an arrow from SysA to SysB
      const contextView = BaseCfour.getSystemContextView("sysA");
      const { edges: contextEdges } = c4ToReactFlow(BaseCfour.getWorkspace(), contextView);

      expect(contextEdges.length).toBe(1);
      expect(contextEdges[0].source).toBe("sysA");
      expect(contextEdges[0].target).toBe("sysB");

      // 2. Verify Level 2 View (Container View for SysA)
      // It should show an arrow from ConA to SysB (since SysB is a neighbor)
      const containerView = BaseCfour.getContainerView("sysA");
      const { edges: containerEdges } = c4ToReactFlow(BaseCfour.getWorkspace(), containerView);

      expect(containerEdges.length).toBe(1);
      expect(containerEdges[0].source).toBe("conA");
      expect(containerEdges[0].target).toBe("sysB");
    });

    test("should validate architectural integrity", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Empty System" });
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "sys1",
        destinationId: "missing",
      });

      const errors = BaseCfour.validate();

      // Should find the dangling relationship
      const relError = errors.find((e) => e.message.includes("Dangling relationship"));
      expect(relError).toBeDefined();
      expect(relError?.severity).toBe("error");

      // Should find the empty system warning
      const sysWarning = errors.find((e) => e.message.includes("no containers"));
      expect(sysWarning).toBeDefined();
      expect(sysWarning?.severity).toBe("warning");
    });

    test("should correctly diff two workspaces", () => {
      BaseCfour.resetWorkspace("Before");
      BaseCfour.addSoftwareSystem(
        { id: "sys1", name: "Old Name", description: "Old Desc" },
        "Before",
      );
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "To Be Removed" }, "Before");

      BaseCfour.resetWorkspace("After");
      BaseCfour.addSoftwareSystem(
        { id: "sys1", name: "New Name", description: "Old Desc" },
        "After",
      );
      BaseCfour.addSoftwareSystem({ id: "sys3", name: "Newly Added" }, "After");

      const diff = BaseCfour.diff("Before", "After");

      // Check added
      expect(diff.nodes.added.length).toBe(1);
      expect(diff.nodes.added[0].id).toBe("sys3");

      // Check removed
      expect(diff.nodes.removed.length).toBe(1);
      expect(diff.nodes.removed[0].id).toBe("sys2");

      // Check modified
      expect(diff.nodes.modified.length).toBe(1);
      expect(diff.nodes.modified[0].id).toBe("sys1");
      expect(diff.nodes.modified[0].changes).toContain("name");
      expect(diff.nodes.modified[0].changes).not.toContain("description");
    });

    test("should support generating a legend for a view", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      // Use addContainer directly to ensure 'React' tech is set on the container
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1", technology: "React" });
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "sys1",
        destinationId: "con1",
        description: "Uses",
        technology: "HTTPS",
      });

      const view = BaseCfour.getContainerView("sys1");
      const legend = BaseCfour.getLegend(view);

      expect(legend.elements.some((e) => e.kind === "Container" && e.technology === "React")).toBe(
        true,
      );
      expect(
        legend.relationships.some((r) => r.description === "Uses" && r.technology === "HTTPS"),
      ).toBe(true);
    });

    test("should lint a workspace against the architecture checklist", () => {
      BaseCfour.resetWorkspace();
      // Add a node with missing description and technology
      BaseCfour.addBuildingBlock("api", "API");
      // Add a relationship with missing description and technology
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "api",
        destinationId: "api",
      } as any);

      const violations = BaseCfour.lint();

      const elementViolations = violations.filter((v) => v.category === "Elements");
      expect(elementViolations.some((v) => v.check.includes("what every element does"))).toBe(true);
      expect(elementViolations.some((v) => v.check.includes("technology choices"))).toBe(true);

      const relViolations = violations.filter((v) => v.category === "Relationships");
      expect(relViolations.some((v) => v.check.includes("arrow have a label"))).toBe(true);
      expect(relViolations.some((v) => v.check.includes("technology choices"))).toBe(true);
    });

    test("should support modeling Queues and Topics as specialized Containers", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Messaging System" });

      BaseCfour.addQueue({
        id: "q1",
        name: "Order Processing Queue",
        systemId: "sys1",
        technology: "RabbitMQ",
      });

      BaseCfour.addTopic({
        id: "t1",
        name: "Customer Events Topic",
        systemId: "sys1",
        technology: "Kafka",
      });

      const ws = BaseCfour.getWorkspace();
      const containers = ws.softwareSystems[0].containers!;

      const queue = containers.find((c) => c.id === "q1");
      expect(queue?.kind).toBe("Queue");
      expect(queue?.technology).toBe("RabbitMQ");

      const topic = containers.find((c) => c.id === "t1");
      expect(topic?.kind).toBe("Topic");
      expect(topic?.technology).toBe("Kafka");

      // Verify adapter picks them up
      const { nodes } = c4ToReactFlow(ws);
      expect(nodes.find((n) => n.id === "q1")?.type).toBe("Queue");
      expect(nodes.find((n) => n.id === "t1")?.type).toBe("Topic");
    });
  });

  describe("flattenWorkspace", () => {
    test("should correctly flatten all nodes and relationships", () => {
      const flat = flattenWorkspace(mockWorkspace);

      // Check nodes count:
      // People: p1, p2 (2)
      // Systems: sys1, sys2 (2)
      // Containers: con1, con2 (2)
      // Components: comp1 (1)
      // Code Elements: code1 (1)
      // Total nodes: 8
      expect(flat.nodes.length).toBe(8);
      expect(flat.relationships.length).toBe(4);

      const nodeIds = flat.nodes.map((n) => n.id);
      expect(nodeIds).toContain("p1");
      expect(nodeIds).toContain("sys1");
      expect(nodeIds).toContain("con1");
      expect(nodeIds).toContain("comp1");
      expect(nodeIds).toContain("code1");
    });
  });

  describe("c4ToReactFlow", () => {
    test("should convert all elements when no view is provided", () => {
      const { nodes, edges } = c4ToReactFlow(mockWorkspace);

      expect(nodes.length).toBe(8);
      expect(edges.length).toBe(4);

      // Check node data mapping
      const webAppNode = nodes.find((n) => n.id === "con1");
      expect(webAppNode?.type).toBe("Container");
      expect(webAppNode?.data.name).toBe("Web App");
      expect(webAppNode?.data.technology).toBe("React");
    });

    test("should filter elements and relationships based on view", () => {
      const view = {
        id: "v1",
        kind: "SystemContext" as const,
        elements: [{ elementId: "p1" }, { elementId: "sys1" }],
        relationships: [{ relationshipId: "r1" }],
      };

      const { nodes, edges } = c4ToReactFlow(mockWorkspace, view);

      expect(nodes.length).toBe(2);
      expect(edges.length).toBe(1);
      expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["p1", "sys1"]));
      expect(edges[0].id).toBe("r1");
    });

    test("should handle useParentNodes for nesting", () => {
      const { nodes } = c4ToReactFlow(mockWorkspace, undefined, { useParentNodes: true });

      const webAppNode = nodes.find((n) => n.id === "con1");
      const dashboardNode = nodes.find((n) => n.id === "comp1");

      expect(webAppNode?.parentId).toBe("sys1");
      expect(dashboardNode?.parentId).toBe("con1");
      expect(webAppNode?.extent).toBe("parent");
    });

    test("should apply transformers", () => {
      const { nodes, edges } = c4ToReactFlow(mockWorkspace, undefined, {
        nodeTransformer: (node) => ({ ...node, data: { ...node.data, transformed: true } }),
        edgeTransformer: (edge) => ({ ...edge, animated: true }),
      });

      expect((nodes[0].data as any).transformed).toBe(true);
      expect(edges.every((e) => e.animated)).toBe(true);
    });

    test("should use custom dimensions", () => {
      const { nodes } = c4ToReactFlow(mockWorkspace, undefined, {
        nodeDimensions: {
          Person: { width: 500, height: 500 },
        },
      });

      const personNode = nodes.find((n) => n.id === "p1");
      expect(personNode?.width).toBe(500);
      expect(personNode?.height).toBe(500);
    });
  });

  describe("View Builders", () => {
    test("buildSystemContextView should include target, neighbors and all persons", () => {
      const view = buildSystemContextView(mockWorkspace, "sys1");

      expect(view.kind).toBe("SystemContext");
      expect(view.scopeId).toBe("sys1");

      const elementIds = view.elements.map((e) => e.elementId);
      expect(elementIds).toContain("sys1"); // target
      expect(elementIds).toContain("sys2"); // neighbor via r2
      expect(elementIds).toContain("p1"); // person
      expect(elementIds).toContain("p2"); // all persons
    });

    test("buildContainerView should include containers of a system", () => {
      const view = buildContainerView(mockWorkspace, "sys1");

      expect(view.kind).toBe("Container");
      expect(view.scopeId).toBe("sys1");

      const elementIds = view.elements.map((e) => e.elementId);
      expect(elementIds).toContain("con1");
      expect(elementIds).toContain("con2");
      expect(elementIds).not.toContain("p1");
    });

    test("buildComponentView should include components of a container", () => {
      const view = buildComponentView(mockWorkspace, "con1");

      expect(view.kind).toBe("Component");
      expect(view.scopeId).toBe("con1");

      const elementIds = view.elements.map((e) => e.elementId);
      expect(elementIds).toContain("comp1");
    });

    test("buildCodeView should include code elements of a component", () => {
      const view = buildCodeView(mockWorkspace, "comp1");

      expect(view.kind).toBe("Code");
      expect(view.scopeId).toBe("comp1");

      const elementIds = view.elements.map((e) => e.elementId);
      expect(elementIds).toContain("code1");
    });
  });
});
