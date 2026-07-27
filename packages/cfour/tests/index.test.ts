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
  diffWorkspaces,
  type C4Workspace,
  type CfourChangeEvent,
  type CfourStorage,
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
      const events: CfourChangeEvent[] = [];
      const unsubscribe = BaseCfour.subscribe((e) => {
        if (e.workspaceName === "default") events.push(e);
      });

      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].elementId).toBe("sys1");

      unsubscribe();
      events.length = 0;
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      expect(events.length).toBe(0);
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

  describe("Structured Change Events", () => {
    test("addPerson emits correct event", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addPerson({ id: "p1", name: "Alice" });
      const ev = events.find((e) => e.elementId === "p1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Person");
      expect(ev!.path).toEqual([]);
      expect(ev!.workspaceName).toBe("default");
      unsub();
    });

    test("addSoftwareSystem emits correct event", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const ev = events.find((e) => e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("SoftwareSystem");
      expect(ev!.path).toEqual([]);
      unsub();
    });

    test("addContainer emits event with systemId in path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      const ev = events.find((e) => e.elementId === "con1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Container");
      expect(ev!.path).toEqual(["sys1"]);
      unsub();
    });

    test("addComponent emits event with full ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addComponent({ id: "comp1", name: "Comp1", containerId: "con1" });
      const ev = events.find((e) => e.elementId === "comp1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Component");
      expect(ev!.path).toEqual(["sys1", "con1"]);
      unsub();
    });

    test("addCodeElement emits event with full ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "Comp1", containerId: "con1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });
      const ev = events.find((e) => e.elementId === "ce1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Class");
      expect(ev!.path).toEqual(["sys1", "con1", "comp1"]);
      unsub();
    });

    test("addRelationship emits correct event", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "sys1",
        destinationId: "sys2",
      });
      const ev = events.find((e) => e.elementId === "r1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Relationship");
      unsub();
    });

    test("updateElement emits event with before/after/changes", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Old Name", description: "Keep" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.updateElement("sys1", { name: "New Name" });
      const ev = events.find((e) => e.op === "update" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.before).toBeDefined();
      expect(ev!.after).toBeDefined();
      expect((ev!.before as any).name).toBe("Old Name");
      expect((ev!.after as any).name).toBe("New Name");
      expect(ev!.changes).toContain("name");
      expect(ev!.changes).not.toContain("description");
      unsub();
    });

    test("removeElement emits correct event", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("sys1");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.elementKind).toBe("SoftwareSystem");
      unsub();
    });

    test("removeElement on nested node includes ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("comp1");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "comp1");
      expect(ev).toBeDefined();
      expect(ev!.path).toEqual(["sys1", "con1"]);
      unsub();
    });

    test("removeElement includes removedDescendants with full subtree", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });
      BaseCfour.addCodeElement({ id: "ce2", name: "CE2", componentId: "comp1" });
      BaseCfour.addRelationship({
        id: "r1",
        kind: "Relationship",
        sourceId: "ce1",
        destinationId: "comp1",
      });
      BaseCfour.addRelationship({
        id: "r2",
        kind: "Relationship",
        sourceId: "sys1",
        destinationId: "con1",
      });

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("con1");

      const ev = events.find((e) => e.op === "remove" && e.elementId === "con1");
      expect(ev).toBeDefined();
      expect(ev!.removedDescendants).toBeDefined();

      // Leaves-first: code elements before component
      const descendantIds = ev!.removedDescendants!.nodes.map((n) => n.id);
      expect(descendantIds).toContain("ce1");
      expect(descendantIds).toContain("ce2");
      expect(descendantIds).toContain("comp1");
      // ce1/ce2 should appear before comp1 (leaves-first)
      expect(descendantIds.indexOf("ce1")).toBeLessThan(descendantIds.indexOf("comp1"));
      expect(descendantIds.indexOf("ce2")).toBeLessThan(descendantIds.indexOf("comp1"));

      // Relationships touching removed nodes are included
      const relIds = ev!.removedDescendants!.relationships.map((r) => r.id);
      expect(relIds).toContain("r1"); // ce1 -> comp1
      expect(relIds).toContain("r2"); // sys1 -> con1

      // Verify the workspace is actually cleaned up
      const ws = BaseCfour.getWorkspace();
      const flat = flattenWorkspace(ws);
      expect(flat.nodes.find((n) => n.id === "con1")).toBeUndefined();
      expect(flat.nodes.find((n) => n.id === "comp1")).toBeUndefined();
      expect(flat.nodes.find((n) => n.id === "ce1")).toBeUndefined();
      expect(flat.nodes.find((n) => n.id === "ce2")).toBeUndefined();
      expect(ws.relationships.find((r) => r.id === "r1")).toBeUndefined();
      expect(ws.relationships.find((r) => r.id === "r2")).toBeUndefined();
      unsub();
    });

    test("removeElement on leaf node has no removedDescendants", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("sys1");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.removedDescendants).toBeUndefined();
      unsub();
    });

    test("removeElement on CodeElement has no removedDescendants", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("ce1");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "ce1");
      expect(ev).toBeDefined();
      expect(ev!.removedDescendants).toBeUndefined();
      unsub();
    });

    test("removeElement cascades: removing System removes all nested nodes", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("sys1");

      const ev = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      const descendantIds = ev!.removedDescendants!.nodes.map((n) => n.id);
      expect(descendantIds).toEqual(expect.arrayContaining(["con1", "comp1", "ce1"]));
      // Leaves-first: ce1 before comp1 before con1
      expect(descendantIds.indexOf("ce1")).toBeLessThan(descendantIds.indexOf("comp1"));
      expect(descendantIds.indexOf("comp1")).toBeLessThan(descendantIds.indexOf("con1"));

      // Workspace should be empty
      const ws = BaseCfour.getWorkspace();
      expect(ws.softwareSystems.length).toBe(0);
      unsub();
    });

    test("resetWorkspace emits reset event", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.resetWorkspace("test-reset");
      const ev = events.find((e) => e.op === "reset" && e.workspaceName === "test-reset");
      expect(ev).toBeDefined();
      unsub();
    });

    test("import emits import event", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.import('{"name":"Imported","people":[],"softwareSystems":[],"relationships":[]}');
      const ev = events.find((e) => e.op === "import");
      expect(ev).toBeDefined();
      unsub();
    });

    test("subscribe + addComponent: observe specific event without polling", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Web" });
      BaseCfour.addContainer({ id: "con1", name: "API", systemId: "sys1" });
      BaseCfour.addComponent({ id: "auth", name: "Auth", containerId: "con1" });

      const addEvent = events.find((e) => e.op === "add" && e.elementId === "auth");
      expect(addEvent).toBeDefined();
      expect(addEvent?.elementKind).toBe("Component");
      expect(addEvent?.path).toEqual(["sys1", "con1"]);
      unsub();
    });
  });

  describe("Batch API", () => {
    test("batch defers notifications until callback completes", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
        expect(events.length).toBe(0);
      });
      expect(events.length).toBe(2);
      expect(events[0].elementId).toBe("s1");
      expect(events[1].elementId).toBe("s2");
      unsub();
    });

    test("nested batch does not flush early", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
          expect(events.length).toBe(0);
        });
        expect(events.length).toBe(0);
      });
      expect(events.length).toBe(2);
      unsub();
    });

    test("batch flushes in order", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.batch(() => {
        BaseCfour.addPerson({ id: "p1", name: "P1" });
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        BaseCfour.addContainer({ id: "c1", name: "C1", systemId: "s1" });
      });
      expect(events.map((e) => e.elementId)).toEqual(["p1", "s1", "c1"]);
      unsub();
    });

    test("batch with no listeners does not throw", () => {
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        });
      }).not.toThrow();
    });

    test("batch discards events if callback throws", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
          throw new Error("batch failed");
        });
      }).toThrow("batch failed");
      expect(events.length).toBe(0);
      unsub();
    });

    test("batch discards only queued events, not prior events", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addSoftwareSystem({ id: "pre", name: "Pre" });
      expect(events.length).toBe(1);
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          throw new Error("batch failed");
        });
      }).toThrow("batch failed");
      // pre-existing event stays, batched events are gone
      expect(events.length).toBe(1);
      expect(events[0].elementId).toBe("pre");
      unsub();
    });
  });

  describe("Behavior Field", () => {
    test("behavior field round-trips through export/import", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({
        id: "ce1",
        name: "MyClass",
        componentId: "comp1",
        behavior: "function greet(name) { return `Hello ${name}`; }",
      });

      const json = BaseCfour.export();
      BaseCfour.resetWorkspace();
      BaseCfour.import(json);

      const ws = BaseCfour.getWorkspace();
      const ce = ws.softwareSystems[0].containers![0].components![0].codeElements![0];
      expect(ce.behavior).toBe("function greet(name) { return `Hello ${name}`; }");
    });

    test("behavior field on Component round-trips through export/import", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({
        id: "comp1",
        name: "C1",
        containerId: "con1",
        behavior: "Handles authentication via JWT tokens",
      });

      const json = BaseCfour.export();
      BaseCfour.resetWorkspace();
      BaseCfour.import(json);

      const ws = BaseCfour.getWorkspace();
      const comp = ws.softwareSystems[0].containers![0].components![0];
      expect(comp.behavior).toBe("Handles authentication via JWT tokens");
    });

    test("diffWorkspaces detects behavior changes on CodeElement", () => {
      const wsA: C4Workspace = {
        name: "A",
        people: [],
        softwareSystems: [
          {
            id: "sys1",
            name: "S1",
            kind: "SoftwareSystem",
            containers: [
              {
                id: "con1",
                name: "C1",
                kind: "Container",
                systemId: "sys1",
                components: [
                  {
                    id: "comp1",
                    name: "C1",
                    kind: "Component",
                    containerId: "con1",
                    codeElements: [
                      {
                        id: "ce1",
                        name: "CE1",
                        kind: "Class",
                        componentId: "comp1",
                        behavior: "old behavior",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        relationships: [],
      };
      const wsB = JSON.parse(JSON.stringify(wsA)) as C4Workspace;
      wsB.softwareSystems[0].containers![0].components![0].codeElements![0].behavior =
        "new behavior";

      const diff = diffWorkspaces(wsA, wsB);
      expect(diff.nodes.modified.length).toBe(1);
      expect(diff.nodes.modified[0].changes).toContain("behavior");
    });

    test("diffWorkspaces detects behavior changes on Component", () => {
      const wsA: C4Workspace = {
        name: "A",
        people: [],
        softwareSystems: [
          {
            id: "sys1",
            name: "S1",
            kind: "SoftwareSystem",
            containers: [
              {
                id: "con1",
                name: "C1",
                kind: "Container",
                systemId: "sys1",
                components: [
                  {
                    id: "comp1",
                    name: "C1",
                    kind: "Component",
                    containerId: "con1",
                    behavior: "old",
                  },
                ],
              },
            ],
          },
        ],
        relationships: [],
      };
      const wsB = JSON.parse(JSON.stringify(wsA)) as C4Workspace;
      wsB.softwareSystems[0].containers![0].components![0].behavior = "new";

      const diff = diffWorkspaces(wsA, wsB);
      expect(diff.nodes.modified.length).toBe(1);
      expect(diff.nodes.modified[0].changes).toContain("behavior");
    });

    test("behavior field is optional and does not break workspace without it", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const ws = BaseCfour.getWorkspace();
      const json = BaseCfour.export();
      const parsed = JSON.parse(json);
      expect(parsed.softwareSystems[0].behavior).toBeUndefined();
    });
  });

  describe("Storage Interface", () => {
    function createMemoryStorage(): CfourStorage & { store: Map<string, string> } {
      const store = new Map<string, string>();
      return {
        store,
        get: async (k) => store.get(k) ?? null,
        put: async (k, v) => {
          store.set(k, v);
        },
        delete: async (k) => {
          store.delete(k);
        },
        list: async (p) => [...store.keys()].filter((k) => k.startsWith(p)),
      };
    }

    test("saveSnapshot persists workspace via storage adapter", async () => {
      const adapter = createMemoryStorage();
      BaseCfour.setStorage(adapter);
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      await BaseCfour.saveSnapshot();
      expect(adapter.store.has("workspace:default")).toBe(true);
      expect(adapter.store.get("workspace:default")).toContain("S1");
    });

    test("loadSnapshot restores workspace from storage", async () => {
      const adapter = createMemoryStorage();
      BaseCfour.setStorage(adapter);
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      await BaseCfour.saveSnapshot();
      BaseCfour.resetWorkspace();
      expect(BaseCfour.getWorkspace().softwareSystems.length).toBe(0);
      await BaseCfour.loadSnapshot();
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("S1");
    });

    test("deleteSnapshot removes workspace from storage", async () => {
      const adapter = createMemoryStorage();
      BaseCfour.setStorage(adapter);
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      await BaseCfour.saveSnapshot();
      await BaseCfour.deleteSnapshot();
      expect(adapter.store.has("workspace:default")).toBe(false);
    });

    test("listSnapshots returns workspace names", async () => {
      const adapter = createMemoryStorage();
      BaseCfour.setStorage(adapter);
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      await BaseCfour.saveSnapshot();
      BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" }, "other");
      await BaseCfour.saveSnapshot("other");
      const names = await BaseCfour.listSnapshots();
      expect(names).toContain("default");
      expect(names).toContain("other");
    });

    test("throws if no storage adapter configured", async () => {
      BaseCfour.setStorage(null as any);
      await expect(BaseCfour.saveSnapshot()).rejects.toThrow("No storage adapter");
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

  describe("findRelationships", () => {
    test("filters by sourceId", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", description: "A",
      });
      BaseCfour.addRelationship({
        id: "r2", kind: "Relationship", sourceId: "sys2", destinationId: "sys1", description: "B",
      });
      const rels = BaseCfour.findRelationships({ sourceId: "sys1" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by destinationId", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2",
      });
      const rels = BaseCfour.findRelationships({ destinationId: "sys2" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by technology", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", technology: "HTTPS",
      });
      BaseCfour.addRelationship({
        id: "r2", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", technology: "gRPC",
      });
      const rels = BaseCfour.findRelationships({ technology: "HTTPS" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by tags", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", tags: ["internal"],
      });
      BaseCfour.addRelationship({
        id: "r2", kind: "Relationship", sourceId: "sys1", destinationId: "sys2",
      });
      const rels = BaseCfour.findRelationships({ tags: ["internal"] });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by search in description and technology", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2",
        description: "Fetches user data", technology: "REST",
      });
      const rels = BaseCfour.findRelationships({ search: "user" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by interactionStyle", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", interactionStyle: "async",
      });
      BaseCfour.addRelationship({
        id: "r2", kind: "Relationship", sourceId: "sys1", destinationId: "sys2", interactionStyle: "sync",
      });
      const rels = BaseCfour.findRelationships({ interactionStyle: "async" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });
  });

  describe("updateRelationship", () => {
    test("updates relationship and emits event with before/after/changes", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship({
        id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2",
        description: "Old", technology: "REST",
      });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.updateRelationship("r1", { description: "New", technology: "gRPC" });
      const ev = events.find((e) => e.op === "update" && e.elementId === "r1");
      expect(ev).toBeDefined();
      expect(ev!.before).toBeDefined();
      expect(ev!.after).toBeDefined();
      expect((ev!.before as any).description).toBe("Old");
      expect((ev!.after as any).description).toBe("New");
      expect(ev!.changes).toContain("description");
      expect(ev!.changes).toContain("technology");
      unsub();
    });

    test("no-op if relationship not found", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.updateRelationship("missing", { description: "X" });
      expect(events.filter((e) => e.op === "update").length).toBe(0);
      unsub();
    });
  });

  describe("getAncestors / getDescendants", () => {
    test("getAncestors returns path from root to node", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });
      const ancestors = BaseCfour.getAncestors("ce1");
      expect(ancestors.map((n) => n.id)).toEqual(["sys1", "con1", "comp1"]);
    });

    test("getAncestors returns empty for top-level node", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      expect(BaseCfour.getAncestors("sys1")).toEqual([]);
    });

    test("getAncestors returns empty for unknown id", () => {
      expect(BaseCfour.getAncestors("missing")).toEqual([]);
    });

    test("getDescendants returns leaves-first subtree", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" });
      BaseCfour.addCodeElement({ id: "ce1", name: "CE1", componentId: "comp1" });
      BaseCfour.addCodeElement({ id: "ce2", name: "CE2", componentId: "comp1" });
      const descendants = BaseCfour.getDescendants("sys1");
      const ids = descendants.map((n) => n.id);
      expect(ids).toEqual(expect.arrayContaining(["con1", "comp1", "ce1", "ce2"]));
      // leaves-first: code elements before component before container
      expect(ids.indexOf("ce1")).toBeLessThan(ids.indexOf("comp1"));
      expect(ids.indexOf("comp1")).toBeLessThan(ids.indexOf("con1"));
    });

    test("getDescendants returns empty for leaf node", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      expect(BaseCfour.getDescendants("sys1")).toEqual([]);
    });

    test("getDescendants returns empty for unknown id", () => {
      expect(BaseCfour.getDescendants("missing")).toEqual([]);
    });
  });

  describe("refreshNode", () => {
    test("updates node metadata and emits update event", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Old", description: "Keep" });
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.refreshNode("sys1", { name: "New", description: "Updated" });
      const ev = events.find((e) => e.op === "update" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect((ev!.after as any).name).toBe("New");
      expect((ev!.after as any).description).toBe("Updated");
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("New");
      unsub();
    });
  });

  describe("Event History", () => {
    test("logs events from mutations", () => {
      BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" });
      const history = BaseCfour.getEventHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[history.length - 2].elementId).toBe("sys1");
      expect(history[history.length - 1].elementId).toBe("con1");
    });

    test("logs events from batch", () => {
      BaseCfour.clearEventHistory();
      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
      });
      const recent = BaseCfour.getRecentEvents(2);
      expect(recent.length).toBe(2);
      expect(recent[0].elementId).toBe("s1");
      expect(recent[1].elementId).toBe("s2");
    });

    test("getRecentEvents returns last n", () => {
      BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "a", name: "A" });
      BaseCfour.addSoftwareSystem({ id: "b", name: "B" });
      BaseCfour.addSoftwareSystem({ id: "c", name: "C" });
      const last2 = BaseCfour.getRecentEvents(2);
      expect(last2.length).toBe(2);
      expect(last2[0].elementId).toBe("b");
      expect(last2[1].elementId).toBe("c");
    });

    test("clearEventHistory empties the log", () => {
      BaseCfour.addSoftwareSystem({ id: "x", name: "X" });
      BaseCfour.clearEventHistory();
      expect(BaseCfour.getEventHistory().length).toBe(0);
    });

    test("setEventLogMax trims old events", () => {
      BaseCfour.clearEventHistory();
      BaseCfour.setEventLogMax(3);
      BaseCfour.addSoftwareSystem({ id: "a", name: "A" });
      BaseCfour.addSoftwareSystem({ id: "b", name: "B" });
      BaseCfour.addSoftwareSystem({ id: "c", name: "C" });
      BaseCfour.addSoftwareSystem({ id: "d", name: "D" });
      const history = BaseCfour.getEventHistory();
      expect(history.length).toBe(3);
      expect(history[0].elementId).toBe("b");
      expect(history[2].elementId).toBe("d");
      BaseCfour.setEventLogMax(1000); // restore default
    });

    test("does not log batch events if callback throws", () => {
      BaseCfour.clearEventHistory();
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "fail", name: "F" });
          throw new Error("boom");
        });
      }).toThrow("boom");
      expect(BaseCfour.getEventHistory().length).toBe(0);
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
