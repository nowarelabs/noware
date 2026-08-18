import { describe, expect, test, beforeEach, vi } from "vite-plus/test";
import {
  BaseCfour,
  flattenWorkspace,
  c4ToReactFlow,
  buildSystemContextView,
  buildContainerView,
  buildComponentView,
  buildCodeView,
  diffWorkspaces,
  rowsToWorkspace,
  type C4Workspace,
  type CfourChangeEvent,
  type CfourStorage,
  type CfourEventStorage,
  type CfourEventQuery,
  type C4Node,
  type C4Relationship,
  type C4Claim,
  type C4RelationshipProposal,
  type C4MergePlan,
  type C4View,
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

    test("each instance is an isolated model; the static facade shares one default", () => {
      const a = new TestQuery();
      const b = new BaseCfour();

      a.addSoftwareSystem({ id: "only-in-a", name: "A" });
      b.addSoftwareSystem({ id: "only-in-b", name: "B" });

      expect(a.getWorkspace().softwareSystems.map((s) => s.id)).toEqual(["only-in-a"]);
      expect(b.getWorkspace().softwareSystems.map((s) => s.id)).toEqual(["only-in-b"]);
      // The static facade delegates to its own default instance, untouched here.
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
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
      BaseCfour.addContainer(
        { id: "con-web", name: "Web App", systemId: "sys-main" },
        "default",
        "local",
      );
      BaseCfour.addComponent(
        { id: "comp-auth", name: "Auth", containerId: "con-web" },
        "default",
        "local",
      );
      BaseCfour.addCodeElement(
        { id: "class-user", name: "User", componentId: "comp-auth" },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "rel-1",
          kind: "Relationship",
          sourceId: "class-user",
          destinationId: "comp-auth",
        },
        "default",
        "local",
      );

      const ws = BaseCfour.getWorkspace();
      expect(ws.name).toBe("Framework Architecture");
      expect(ws.softwareSystems[0].containers![0].components![0].codeElements![0].name).toBe(
        "User",
      );
      expect(ws.relationships.length).toBe(1);
    });

    test("should throw error when parent is missing", () => {
      BaseCfour.resetWorkspace();
      expect(() =>
        BaseCfour.addContainer({ id: "c1", name: "C1", systemId: "missing" }, "default", "local"),
      ).toThrow(/Software System with id "missing" not found/);
    });

    test("should support drilling by providing childCount and canDrill metadata", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "System 1" });
      BaseCfour.addContainer(
        { id: "con1", name: "Container 1", systemId: "sys1" },
        "default",
        "local",
      );

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
      BaseCfour.addContainer(
        { id: "con1", name: "Container 1", systemId: "sys1" },
        "default",
        "local",
      );

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

    test("should support interactive editing (update and remove)", () => {
      BaseCfour.resetWorkspace();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "Original" });

      // Update
      BaseCfour.updateElement("sys1", { name: "Updated" }, "default", "local");
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("Updated");

      // Remove
      BaseCfour.removeElement("sys1", "default", "local");
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
      BaseCfour.addSoftwareSystem({ id: "framework", name: "Framework" });
      BaseCfour.addContainer(
        {
          id: "api",
          name: "API",
          systemId: "framework",
          description: "Backend",
          technology: "Node.js",
        },
        "default",
        "local",
      );

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
      expect(teamNodes.length).toBe(0); // nothing owned by Team A yet
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
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "svc-1",
          destinationId: "svc-3",
          description: "Calls",
        },
        "default",
        "local",
      );

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
      BaseCfour.addSoftwareSystem({ id: "framework", name: "Framework" });
      BaseCfour.addContainer(
        {
          id: "gateway",
          name: "API Gateway",
          systemId: "framework",
          description: "Entry point",
          technology: "Nginx",
        },
        "default",
        "local",
      );
      BaseCfour.addContainer(
        {
          id: "db",
          name: "Database",
          systemId: "framework",
          description: "Sensitive data",
          technology: "PostgreSQL",
        },
        "default",
        "local",
      );

      // Network flows
      BaseCfour.addRelationship(
        {
          id: "f1",
          kind: "Relationship",
          sourceId: "internet",
          destinationId: "gateway",
          description: "Inbound traffic",
          technology: "HTTPS/443",
          tags: ["internet-flow", "security-critical"],
        },
        "default",
        "local",
      );

      BaseCfour.addRelationship(
        {
          id: "f2",
          kind: "Relationship",
          sourceId: "gateway",
          destinationId: "db",
          description: "Database access",
          technology: "SQL/5432",
          tags: ["internal-flow"],
        },
        "default",
        "local",
      );

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
      BaseCfour.addContainer(
        { id: "conA", name: "Container A", systemId: "sysA" },
        "default",
        "local",
      );

      // System B with Container B
      BaseCfour.addSoftwareSystem({ id: "sysB", name: "System B" });
      BaseCfour.addContainer(
        { id: "conB", name: "Container B", systemId: "sysB" },
        "default",
        "local",
      );

      // Relationship at the GRANULAR level (Container to Container)
      BaseCfour.addRelationship(
        {
          id: "rel-deep",
          kind: "Relationship",
          sourceId: "conA",
          destinationId: "conB",
          description: "Sends data",
        },
        "default",
        "local",
      );

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
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "missing",
        },
        "default",
        "local",
      );

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
      BaseCfour.addContainer(
        { id: "con1", name: "C1", systemId: "sys1", technology: "React" },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
          description: "Uses",
          technology: "HTTPS",
        },
        "default",
        "local",
      );

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
      BaseCfour.addSoftwareSystem({ id: "framework", name: "Framework" });
      BaseCfour.addContainer({ id: "api", name: "API", systemId: "framework" }, "default", "local");
      // Add a relationship with missing description and technology
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "api",
          destinationId: "api",
        } as any,
        "default",
        "local",
      );

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

      BaseCfour.addQueue(
        {
          id: "q1",
          name: "Order Processing Queue",
          systemId: "sys1",
          technology: "RabbitMQ",
        },
        "default",
        "local",
      );

      BaseCfour.addTopic(
        {
          id: "t1",
          name: "Customer Events Topic",
          systemId: "sys1",
          technology: "Kafka",
        },
        "default",
        "local",
      );

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
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      const ev = events.find((e) => e.elementId === "con1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Container");
      expect(ev!.path).toEqual(["sys1"]);
      unsub();
    });

    test("addComponent emits event with full ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addComponent(
        { id: "comp1", name: "Comp1", containerId: "con1" },
        "default",
        "local",
      );
      const ev = events.find((e) => e.elementId === "comp1");
      expect(ev).toBeDefined();
      expect(ev!.op).toBe("add");
      expect(ev!.elementKind).toBe("Component");
      expect(ev!.path).toEqual(["sys1", "con1"]);
      unsub();
    });

    test("addCodeElement emits event with full ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent(
        { id: "comp1", name: "Comp1", containerId: "con1" },
        "default",
        "local",
      );
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
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
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );
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
      BaseCfour.updateElement("sys1", { name: "New Name" }, "default", "local");
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
      BaseCfour.removeElement("sys1", "default", "local");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.elementKind).toBe("SoftwareSystem");
      unsub();
    });

    test("removeElement on nested node includes ancestry path", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("comp1", "default", "local");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "comp1");
      expect(ev).toBeDefined();
      expect(ev!.path).toEqual(["sys1", "con1"]);
      unsub();
    });

    test("removeElement includes removedDescendants with full subtree", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addCodeElement(
        { id: "ce2", name: "CE2", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "ce1",
          destinationId: "comp1",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("con1", "default", "local");

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
      BaseCfour.removeElement("sys1", "default", "local");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect(ev!.removedDescendants).toBeUndefined();
      unsub();
    });

    test("removeElement on CodeElement has no removedDescendants", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("ce1", "default", "local");
      const ev = events.find((e) => e.op === "remove" && e.elementId === "ce1");
      expect(ev).toBeDefined();
      expect(ev!.removedDescendants).toBeUndefined();
      unsub();
    });

    test("removeElement cascades: removing System removes all nested nodes", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("sys1", "default", "local");

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
      BaseCfour.addContainer({ id: "con1", name: "API", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "auth", name: "Auth", containerId: "con1" }, "default", "local");

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
        BaseCfour.addContainer({ id: "c1", name: "C1", systemId: "s1" }, "default", "local");
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

    test("a throwing batch rolls back workspace mutations", () => {
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
          throw new Error("batch failed");
        });
      }).toThrow("batch failed");
      // The workspace is untouched — no half-applied mutations linger.
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
    });

    test("a caught inner batch failure rolls back only the inner mutations", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        expect(() => {
          BaseCfour.batch(() => {
            BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
            throw new Error("inner failed");
          });
        }).toThrow("inner failed");
        BaseCfour.addSoftwareSystem({ id: "s3", name: "S3" });
      });
      // Inner mutation rolled back; outer mutations committed and flushed.
      expect(BaseCfour.getWorkspace().softwareSystems.map((s) => s.id)).toEqual(["s1", "s3"]);
      expect(events.map((e) => e.elementId)).toEqual(["s1", "s3"]);
      unsub();
    });

    test("an uncaught inner batch failure rolls back everything since the outer batch began", () => {
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          BaseCfour.batch(() => {
            BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
            throw new Error("inner failed");
          });
        });
      }).toThrow("inner failed");
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
    });

    test("a throwing batch rolls back non-default workspaces and drops workspaces created inside it", () => {
      BaseCfour.addSoftwareSystem({ id: "keep", name: "Keep" }, "desired");
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.resetWorkspace("created-in-batch");
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" }, "desired");
          throw new Error("batch failed");
        });
      }).toThrow("batch failed");

      // Pre-existing content in a non-default workspace is restored…
      expect(BaseCfour.getWorkspace("desired").softwareSystems.map((s) => s.id)).toEqual(["keep"]);
      // …and a workspace born inside the failed batch no longer exists.
      expect(BaseCfour.getWorkspaceNames()).not.toContain("created-in-batch");
    });

    test("outer rollback works even when the workspace was only touched via a successful inner batch", () => {
      // The outer level never fetches "desired" itself, so its lazy snapshot
      // can only exist if the inner level's baseline is promoted upward.
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.batch(() => {
            BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          });
          throw new Error("outer failed");
        });
      }).toThrow("outer failed");
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
    });

    test("outer rollback after a caught inner failure restores the outer baseline", () => {
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
          try {
            BaseCfour.batch(() => {
              BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
              throw new Error("inner failed");
            });
          } catch {
            // swallowed — outer continues
          }
          BaseCfour.addSoftwareSystem({ id: "s3", name: "S3" });
          throw new Error("outer failed");
        });
      }).toThrow("outer failed");
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
    });
  });

  describe("Behavior Field", () => {
    test("behavior field round-trips through export/import", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        {
          id: "ce1",
          name: "MyClass",
          componentId: "comp1",
          behavior: "function greet(name) { return `Hello ${name}`; }",
        },
        "default",
        "local",
      );

      const json = BaseCfour.export();
      BaseCfour.resetWorkspace();
      BaseCfour.import(json);

      const ws = BaseCfour.getWorkspace();
      const ce = ws.softwareSystems[0].containers![0].components![0].codeElements![0];
      expect(ce.behavior).toBe("function greet(name) { return `Hello ${name}`; }");
    });

    test("behavior field on Component round-trips through export/import", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent(
        {
          id: "comp1",
          name: "C1",
          containerId: "con1",
          behavior: "Handles authentication via JWT tokens",
        },
        "default",
        "local",
      );

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

    test("diffWorkspaces ignores key order and explicit undefined values", () => {
      const base: C4Workspace = {
        name: "A",
        people: [],
        softwareSystems: [
          {
            id: "sys1",
            name: "S1",
            kind: "SoftwareSystem",
            description: "d",
          },
        ],
        relationships: [],
      };

      // Same data, keys reordered and one explicit undefined field added.
      const reordered = JSON.parse(JSON.stringify(base)) as C4Workspace;
      const sys = reordered.softwareSystems[0];
      const { id, name, kind, description } = sys;
      reordered.softwareSystems[0] = {
        kind,
        description,
        name,
        id,
        technology: undefined,
      } as any;

      expect(diffWorkspaces(base, reordered).nodes.modified).toHaveLength(0);

      // A real value change is still detected.
      const changed = JSON.parse(JSON.stringify(base)) as C4Workspace;
      changed.softwareSystems[0].description = "different";
      expect(diffWorkspaces(base, changed).nodes.modified.length).toBe(1);
    });

    test("behavior field is optional and does not break workspace without it", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const ws = BaseCfour.getWorkspace();
      expect(ws.softwareSystems).toHaveLength(1);
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
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          description: "A",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys2",
          destinationId: "sys1",
          description: "B",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ sourceId: "sys1" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by destinationId", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ destinationId: "sys2" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by technology", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          technology: "HTTPS",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          technology: "gRPC",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ technology: "HTTPS" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by tags", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          tags: ["internal"],
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ tags: ["internal"] });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by search in description and technology", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          description: "Fetches user data",
          technology: "REST",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ search: "user" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });

    test("filters by interactionStyle", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          interactionStyle: "async",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          interactionStyle: "sync",
        },
        "default",
        "local",
      );
      const rels = BaseCfour.findRelationships({ interactionStyle: "async" });
      expect(rels.length).toBe(1);
      expect(rels[0].id).toBe("r1");
    });
  });

  describe("updateRelationship", () => {
    test("updates relationship and emits event with before/after/changes", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          description: "Old",
          technology: "REST",
        },
        "default",
        "local",
      );
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.updateRelationship(
        "r1",
        { description: "New", technology: "gRPC" },
        "default",
        "local",
      );
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
      BaseCfour.updateRelationship("missing", { description: "X" }, "default", "local");
      expect(events.filter((e) => e.op === "update").length).toBe(0);
      unsub();
    });
  });

  describe("getAncestors / getDescendants", () => {
    test("getAncestors returns path from root to node", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
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
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "C1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addCodeElement(
        { id: "ce2", name: "CE2", componentId: "comp1" },
        "default",
        "local",
      );
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
      BaseCfour.refreshNode("sys1", { name: "New", description: "Updated" }, "default", "local");
      const ev = events.find((e) => e.op === "update" && e.elementId === "sys1");
      expect(ev).toBeDefined();
      expect((ev!.after as any).name).toBe("New");
      expect((ev!.after as any).description).toBe("Updated");
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("New");
      unsub();
    });
  });

  describe("Event History", () => {
    test("logs events from mutations", async () => {
      await BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      const history = await BaseCfour.getEventHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[history.length - 2].elementId).toBe("sys1");
      expect(history[history.length - 1].elementId).toBe("con1");
    });

    test("logs events from batch", async () => {
      await BaseCfour.clearEventHistory();
      BaseCfour.batch(() => {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
      });
      const recent = await BaseCfour.getRecentEvents(2);
      expect(recent.length).toBe(2);
      expect(recent[0].elementId).toBe("s1");
      expect(recent[1].elementId).toBe("s2");
    });

    test("getRecentEvents returns last n", async () => {
      await BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "a", name: "A" });
      BaseCfour.addSoftwareSystem({ id: "b", name: "B" });
      BaseCfour.addSoftwareSystem({ id: "c", name: "C" });
      const last2 = await BaseCfour.getRecentEvents(2);
      expect(last2.length).toBe(2);
      expect(last2[0].elementId).toBe("b");
      expect(last2[1].elementId).toBe("c");
    });

    test("clearEventHistory empties the log", async () => {
      BaseCfour.addSoftwareSystem({ id: "x", name: "X" });
      await BaseCfour.clearEventHistory();
      const history = await BaseCfour.getEventHistory();
      expect(history.length).toBe(0);
    });

    test("setEventLogMax trims old events", async () => {
      await BaseCfour.clearEventHistory();
      BaseCfour.setEventLogMax(3);
      BaseCfour.addSoftwareSystem({ id: "a", name: "A" });
      BaseCfour.addSoftwareSystem({ id: "b", name: "B" });
      BaseCfour.addSoftwareSystem({ id: "c", name: "C" });
      BaseCfour.addSoftwareSystem({ id: "d", name: "D" });
      const history = await BaseCfour.getEventHistory();
      expect(history.length).toBe(3);
      expect(history[0].elementId).toBe("b");
      expect(history[2].elementId).toBe("d");
      BaseCfour.setEventLogMax(1000); // restore default
    });

    test("does not log batch events if callback throws", async () => {
      await BaseCfour.clearEventHistory();
      expect(() => {
        BaseCfour.batch(() => {
          BaseCfour.addSoftwareSystem({ id: "fail", name: "F" });
          throw new Error("boom");
        });
      }).toThrow("boom");
      const history = await BaseCfour.getEventHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("Event Storage Adapter", () => {
    const createMockStorage = (): CfourEventStorage & { events: CfourChangeEvent[] } => {
      const events: CfourChangeEvent[] = [];
      return {
        events,
        async append(event: CfourChangeEvent) {
          events.push(event);
        },
        async query(filter: CfourEventQuery) {
          let result = [...events];
          if (filter.elementId) result = result.filter((e) => e.elementId === filter.elementId);
          if (filter.op) result = result.filter((e) => e.op === filter.op);
          if (filter.since) result = result.filter((e) => (e.timestamp ?? 0) >= filter.since!);
          if (filter.until) result = result.filter((e) => (e.timestamp ?? 0) <= filter.until!);
          if (filter.limit) result = result.slice(-filter.limit);
          return result;
        },
        async clear() {
          events.length = 0;
        },
      };
    };

    test("events are persisted to storage adapter", async () => {
      const mock = createMockStorage();
      BaseCfour.setEventStorage(mock);
      await BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
      expect(mock.events.length).toBe(2);
      expect(mock.events[0].elementId).toBe("s1");
      expect(mock.events[1].elementId).toBe("s2");
      BaseCfour.setEventStorage(null);
    });

    test("queryEventHistory delegates to adapter", async () => {
      const mock = createMockStorage();
      BaseCfour.setEventStorage(mock);
      await BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "s2", name: "S2" });
      BaseCfour.addContainer({ id: "c1", name: "C1", systemId: "s1" }, "default", "local");
      const systems = await BaseCfour.queryEventHistory({ op: "add" });
      const byId = await BaseCfour.queryEventHistory({ elementId: "s1" });
      expect(systems.length).toBe(3);
      expect(byId.length).toBe(1);
      expect(byId[0].elementId).toBe("s1");
      BaseCfour.setEventStorage(null);
    });

    test("clearEventHistory clears the adapter", async () => {
      const mock = createMockStorage();
      BaseCfour.setEventStorage(mock);
      BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
      expect(mock.events.length).toBe(1);
      await BaseCfour.clearEventHistory();
      expect(mock.events.length).toBe(0);
      BaseCfour.setEventStorage(null);
    });

    test("events still appear in in-memory log with storage adapter set", async () => {
      const mock = createMockStorage();
      BaseCfour.setEventStorage(mock);
      await BaseCfour.clearEventHistory();
      BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
      const history = await BaseCfour.getEventHistory();
      expect(history.length).toBe(1);
      expect(mock.events.length).toBe(1);
      BaseCfour.setEventStorage(null);
    });

    test("a failing event storage append warns instead of failing silently", async () => {
      const failing: CfourEventStorage = {
        async append() {
          throw new Error("disk full");
        },
        async query() {
          return [];
        },
        async clear() {},
      };
      BaseCfour.setEventStorage(failing);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" });
        // The append is fire-and-forget; let the rejection propagate to its catch.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("disk full"));
      } finally {
        warn.mockRestore();
        BaseCfour.setEventStorage(null);
      }
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

  describe("Selections (getSubtree / getSelection)", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("getSubtree returns root + all descendants + only-internal relationships", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "P1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "comp1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );

      const sel = BaseCfour.getSubtree("sys1");
      expect(sel.elementIds.sort()).toEqual(["ce1", "comp1", "con1", "sys1"]);
      // r1 is internal; r2 crosses outside the subtree and must be excluded.
      expect(sel.relationshipIds).toEqual(["r1"]);

      const nested = BaseCfour.getSubtree("con1");
      expect(nested.elementIds.sort()).toEqual(["ce1", "comp1", "con1"]);
      // r1's source (sys1) is outside the nested subtree, so it is excluded.
      expect(nested.relationshipIds).toEqual([]);

      expect(() => BaseCfour.getSubtree("missing")).toThrow(/not found/);
    });

    test("getSelection matches filters and excludes cross-boundary relationships", () => {
      BaseCfour.addSoftwareSystem({
        id: "sys1",
        name: "Web",
        owner: "Team A",
        tags: ["frontend"],
      });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "API" });
      BaseCfour.addContainer(
        {
          id: "con1",
          name: "Web Gateway",
          systemId: "sys1",
          technology: "React",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );

      const bySearch = BaseCfour.getSelection({ search: "Web" });
      expect(bySearch.elementIds.sort()).toEqual(["con1", "sys1"]);
      // r1 crosses to sys2 (outside) → excluded; r2 is internal → included.
      expect(bySearch.relationshipIds).toEqual(["r2"]);

      // technology only matches Container/Component/CodeElement (SoftwareSystem is excluded)
      expect(BaseCfour.getSelection({ technology: "React" }).elementIds).toEqual(["con1"]);
      expect(BaseCfour.getSelection({ technology: "node" }).elementIds).toEqual([]);
      expect(BaseCfour.getSelection({ owner: "Team A" }).elementIds).toEqual(["sys1"]);
      expect(BaseCfour.getSelection({ tags: ["frontend"] }).elementIds).toEqual(["sys1"]);

      const allSystems = BaseCfour.getSelection({ kind: "SoftwareSystem" });
      expect(allSystems.elementIds.sort()).toEqual(["sys1", "sys2"]);
      // r1 endpoints are both inside the matched set; r2 crosses to con1 (outside).
      expect(allSystems.relationshipIds).toEqual(["r1"]);
    });
  });

  describe("Claims", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("claim rejects overlap with an existing claim, including your own, and emits a claim event", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      const alice = BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
      expect(alice.id).toBeDefined();
      expect(alice.editorId).toBe("alice");

      const claimEv = events.find((e) => e.op === "claim");
      expect(claimEv).toBeDefined();
      expect((claimEv!.payload as C4Claim).id).toBe(alice.id);
      expect((claimEv!.payload as C4Claim).editorId).toBe("alice");
      unsub();

      // Different editor overlapping
      expect(() => BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "bob")).toThrow(
        /overlaps claim/,
      );

      // Same editor re-claiming overlapping scope must also throw
      expect(() =>
        BaseCfour.claim({ elementIds: ["sys1", "sys2"], relationshipIds: [] }, "alice"),
      ).toThrow(/overlaps claim/);

      // Disjoint selection succeeds
      const bob = BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob");
      expect(bob.editorId).toBe("bob");
      expect(BaseCfour.getClaims().map((c) => c.id)).toEqual([alice.id, bob.id]);
    });

    test("release is a no-op for unknown ids; releaseAllClaimsFor releases every claim of an editor", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addSoftwareSystem({ id: "sys3", name: "S3" });

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      BaseCfour.release("does-not-exist"); // no-op, must not throw
      const a1 = BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob");
      const a2 = BaseCfour.claim({ elementIds: ["sys3"], relationshipIds: [] }, "alice");

      BaseCfour.releaseAllClaimsFor("alice");
      expect(BaseCfour.getClaims().map((c) => c.editorId)).toEqual(["bob"]);
      const releases = events.filter((e) => e.op === "release");
      expect(releases.length).toBe(2);
      expect(releases.map((e) => (e.payload as C4Claim).id).sort()).toEqual([a1.id, a2.id].sort());
      unsub();
    });

    test("touchClaim refreshes a claim and expireStaleClaims releases only stale ones", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });

      const stale = BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
      stale.lastSeenAt = Date.now() - 100_000;

      const fresh = BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob");
      BaseCfour.touchClaim(fresh.id);

      const expired = BaseCfour.expireStaleClaims("default", 60_000);
      expect(expired).toEqual([stale.id]);
      expect(BaseCfour.getClaimFor("sys1")).toBeUndefined();
      expect(BaseCfour.getClaimFor("sys2")?.id).toBe(fresh.id);

      expect(() => BaseCfour.touchClaim("missing")).toThrow(/not found/);
    });

    test("setClaimTtl drives the expireStaleClaims default threshold", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.setClaimTtl(1);
      const claim = BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
      claim.lastSeenAt = Date.now() - 1000;
      expect(BaseCfour.expireStaleClaims()).toContain(claim.id);
      BaseCfour.setClaimTtl(5 * 60 * 1000); // restore default
    });

    test("setClaimTtl per-workspace override wins only in that workspace", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "other");
      BaseCfour.setClaimTtl(5 * 60 * 1000); // reset the instance default
      BaseCfour.setClaimTtl(1, "main");

      // "main" uses its 1ms override — the stale claim is reaped.
      const claimed = BaseCfour.claim(
        { elementIds: ["sys1"], relationshipIds: [] },
        "alice",
        "main",
      );
      claimed.lastSeenAt = Date.now() - 1000;
      expect(BaseCfour.expireStaleClaims("main")).toContain(claimed.id);

      // "other" falls back to the instance default (5 min) — not reaped.
      const other = BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob", "other");
      other.lastSeenAt = Date.now() - 1000;
      expect(BaseCfour.expireStaleClaims("other")).toEqual([]);
      BaseCfour.setClaimTtl(5 * 60 * 1000); // restore default
    });

    test("claim rejects the reserved system editor id", () => {
      expect(() =>
        BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "__system__"),
      ).toThrow(/reserved for system-level operations/);
      expect(BaseCfour.getClaims()).toHaveLength(0);
    });
  });

  describe("Claim Enforcement on Mutators", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("mutators reject edits from a different editorId than the claim holder", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent({ id: "comp1", name: "P1", containerId: "con1" }, "default", "local");
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );

      BaseCfour.claim(
        { elementIds: ["sys1", "con1", "comp1", "ce1"], relationshipIds: ["r1"] },
        "alice",
      );

      expect(() => BaseCfour.updateElement("sys1", { name: "X" }, "default", "bob")).toThrow(
        /claimed by editor "alice"/,
      );
      expect(() => BaseCfour.removeElement("sys1", "default", "bob")).toThrow(
        /claimed by editor "alice"/,
      );
      expect(() =>
        BaseCfour.addContainer({ id: "con2", name: "C2", systemId: "sys1" }, "default", "bob"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.addComponent({ id: "comp2", name: "P2", containerId: "con1" }, "default", "bob"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.addCodeElement(
          { id: "ce2", name: "CE2", componentId: "comp1" },
          "default",
          "bob",
        ),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.addQueue({ id: "q1", name: "Q1", systemId: "sys1" }, "default", "bob"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.addTopic({ id: "t1", name: "T1", systemId: "sys1" }, "default", "bob"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.updateRelationship("r1", { description: "x" }, "default", "bob"),
      ).toThrow(/claimed by editor "alice"/);
    });

    test("editing a claimed element requires holding that claim", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );
      BaseCfour.claim({ elementIds: ["sys1", "con1"], relationshipIds: ["r1"] }, "alice");

      // Any caller who is not the claim holder is rejected.
      expect(() =>
        BaseCfour.updateElement("sys1", { name: "Renamed" }, "default", "local"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.updateRelationship("r1", { description: "updated" }, "default", "local"),
      ).toThrow(/claimed by editor "alice"/);
      expect(() =>
        BaseCfour.addContainer({ id: "con2", name: "C2", systemId: "sys1" }, "default", "local"),
      ).toThrow(/claimed by editor "alice"/);

      // The claim holder may edit freely, and their children auto-absorb.
      BaseCfour.updateElement("sys1", { name: "Renamed" }, "default", "alice");
      BaseCfour.updateRelationship("r1", { description: "updated" }, "default", "alice");
      BaseCfour.addContainer({ id: "con2", name: "C2", systemId: "sys1" }, "default", "alice");
      BaseCfour.removeElement("con2", "default", "alice");

      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("Renamed");
      expect(BaseCfour.getWorkspace().relationships[0].description).toBe("updated");
      expect(BaseCfour.getWorkspace().softwareSystems[0].containers!.length).toBe(1);
    });

    test("creating a child under a claimed parent auto-absorbs the child's id", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const claim = BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");

      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "alice");
      expect(claim.elementIds.has("con1")).toBe(true);

      BaseCfour.addComponent({ id: "comp1", name: "P1", containerId: "con1" }, "default", "alice");
      expect(claim.elementIds.has("comp1")).toBe(true);

      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "alice",
      );
      expect(claim.elementIds.has("ce1")).toBe(true);
    });

    test("updateRelationship on a claim-uncovered relationship is a no-op check", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
        },
        "default",
        "local",
      );
      BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");

      expect(() =>
        BaseCfour.updateRelationship("r1", { description: "z" }, "default", "bob"),
      ).not.toThrow();
      expect(BaseCfour.getWorkspace().relationships[0].description).toBe("z");
    });
  });

  describe("removeElement claim integration", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("removeElement purges removed ids from claims and auto-releases an emptied claim", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
        },
        "default",
        "local",
      );
      const claim = BaseCfour.claim(
        { elementIds: ["sys1", "con1"], relationshipIds: ["r1"] },
        "alice",
      );

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.removeElement("sys1", "default", "alice");
      unsub();

      expect(claim.elementIds.has("sys1")).toBe(false);
      expect(claim.elementIds.has("con1")).toBe(false);
      expect(claim.relationshipIds.has("r1")).toBe(false);
      expect(BaseCfour.getClaims()).toHaveLength(0);

      const releaseEv = events.find((e) => e.op === "release");
      expect(releaseEv).toBeDefined();
      expect((releaseEv!.payload as C4Claim).id).toBe(claim.id);
      const removeEv = events.find((e) => e.op === "remove" && e.elementId === "sys1");
      expect(removeEv).toBeDefined();
    });

    test("removeElement purges only removed ids, keeping the rest of a claim", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      const claim = BaseCfour.claim({ elementIds: ["sys1", "sys2"], relationshipIds: [] }, "alice");

      BaseCfour.removeElement("sys1", "default", "alice");

      expect(claim.elementIds.has("sys1")).toBe(false);
      expect(claim.elementIds.has("sys2")).toBe(true);
      expect(BaseCfour.getClaims()).toHaveLength(1);
      expect(BaseCfour.getClaimFor("sys2")).toBe(claim);
      expect(BaseCfour.getClaimFor("sys1")).toBeUndefined();
    });
  });

  describe("Relationship Joint-Claim Proposals", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    function seedCrossClaimedWorkspace() {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice");
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob");
    }

    test("addRelationship throws across two editors' claims, pointing at proposeRelationship", () => {
      seedCrossClaimedWorkspace();
      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "sys1",
        destinationId: "sys2",
        description: "calls",
      };

      // A third editor crosses two different editors' claims
      expect(() => BaseCfour.addRelationship(rel, "default", "carol")).toThrow(
        /proposeRelationship/i,
      );
      // Even one of the two claim holders cannot add it directly
      expect(() => BaseCfour.addRelationship(rel, "default", "alice")).toThrow(
        /proposeRelationship/i,
      );

      // A relationship spanning two editors' claims is rejected for every caller,
      // including editors who hold neither endpoint
      expect(() => BaseCfour.addRelationship({ ...rel, id: "r2" }, "default", "local")).toThrow(
        /proposeRelationship/i,
      );

      // Endpoints claimed by the same single editor are fine
      BaseCfour.addSoftwareSystem({ id: "sys3", name: "S3" });
      BaseCfour.claim({ elementIds: ["sys3"], relationshipIds: [] }, "dave");
      expect(() =>
        BaseCfour.addRelationship(
          { id: "r3", kind: "Relationship", sourceId: "sys3", destinationId: "sys3" },
          "default",
          "dave",
        ),
      ).not.toThrow();
    });

    test("proposeRelationship → acceptRelationship end-to-end", () => {
      seedCrossClaimedWorkspace();
      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "sys1",
        destinationId: "sys2",
        description: "calls",
      };

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      const proposal = BaseCfour.proposeRelationship(rel, "carol");
      expect(Array.from(proposal.pendingApprovals).sort()).toEqual(["alice", "bob"]);
      expect(BaseCfour.getRelationshipProposals().map((p) => p.id)).toEqual([proposal.id]);

      // Relationship does not exist yet
      expect(BaseCfour.findRelationships({ sourceId: "sys1" })).toHaveLength(0);

      // The proposer has no approval standing
      expect(() => BaseCfour.acceptRelationship(proposal.id, "carol")).toThrow(/not required/);

      // First approval recorded — still not created
      BaseCfour.acceptRelationship(proposal.id, "alice");
      expect(BaseCfour.findRelationships({ sourceId: "sys1" })).toHaveLength(0);
      expect(events.filter((e) => e.op === "add").length).toBe(0);

      // Final approval → created via the normal path + acceptRelationship event
      BaseCfour.acceptRelationship(proposal.id, "bob");
      expect(BaseCfour.findRelationships({ sourceId: "sys1" }).map((r) => r.id)).toEqual(["r1"]);
      expect(BaseCfour.getRelationshipProposals()).toHaveLength(0);

      const addEv = events.find((e) => e.op === "add" && e.elementId === "r1");
      expect(addEv).toBeDefined();
      expect(addEv!.elementKind).toBe("Relationship");

      const acceptEv = events.find((e) => e.op === "acceptRelationship");
      expect(acceptEv).toBeDefined();
      expect((acceptEv!.payload as C4RelationshipProposal).id).toBe(proposal.id);
      unsub();
    });

    test("rejectRelationship withdraws a proposal without creating the relationship", () => {
      seedCrossClaimedWorkspace();
      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "sys1",
        destinationId: "sys2",
      };

      const proposal = BaseCfour.proposeRelationship(rel, "carol");
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.rejectRelationship(proposal.id, "alice");
      unsub();

      expect(BaseCfour.getRelationshipProposals()).toHaveLength(0);
      expect(BaseCfour.findRelationships({ sourceId: "sys1" })).toHaveLength(0);
      expect(events.find((e) => e.op === "rejectRelationship")).toBeDefined();

      // Unknown proposal id throws
      expect(() => BaseCfour.rejectRelationship(proposal.id, "alice")).toThrow(/not found/);

      // No standing throws
      const p2 = BaseCfour.proposeRelationship(rel, "carol");
      expect(() => BaseCfour.rejectRelationship(p2.id, "someone-else")).toThrow(/no standing/);
      expect(BaseCfour.getRelationshipProposals().map((p) => p.id)).toEqual([p2.id]);

      // The proposer can withdraw
      const p3 = BaseCfour.proposeRelationship(rel, "carol");
      BaseCfour.rejectRelationship(p3.id, "carol");
      expect(BaseCfour.getRelationshipProposals().map((p) => p.id)).toEqual([p2.id]);
    });

    test("proposeRelationship throws when the relationship does not cross a claim boundary", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.claim({ elementIds: ["sys1", "sys2"], relationshipIds: [] }, "carol");

      expect(() =>
        BaseCfour.proposeRelationship(
          { id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2" },
          "carol",
        ),
      ).toThrow(/use addRelationship/i);
    });
  });

  describe("Branching & Merging", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("branchWorkspace + planMerge + applyMerge full happy path", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "system" }, "main");
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "main", "local");
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "con1",
          description: "uses",
        },
        "main",
        "local",
      );

      BaseCfour.branchWorkspace("main", "feature");

      // Independent change on the branch
      BaseCfour.updateElement("sys1", { name: "S1-branch" }, "feature", "local");
      BaseCfour.addComponent({ id: "comp1", name: "P1", containerId: "con1" }, "feature", "local");
      BaseCfour.addRelationship(
        {
          id: "r2",
          kind: "Relationship",
          sourceId: "comp1",
          destinationId: "sys1",
          description: "belongs",
        },
        "feature",
        "local",
      );

      // Independent change on the target
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "main");
      BaseCfour.updateElement("con1", { description: "updated on main" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.branch).toBe("feature");
      expect(plan.into).toBe("main");
      expect(plan.conflicts).toEqual([]);
      expect(plan.branchChanges.nodes.modified.map((m) => m.id)).toContain("sys1");
      expect(plan.branchChanges.nodes.added.map((n) => n.id)).toContain("comp1");
      expect(plan.targetChanges.nodes.added.map((n) => n.id)).toContain("sys2");

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.applyMerge(plan, "main");
      unsub();

      const ws = BaseCfour.getWorkspace("main");
      expect(ws.softwareSystems.map((s) => s.id).sort()).toEqual(["sys1", "sys2"]);
      const sys1 = ws.softwareSystems.find((s) => s.id === "sys1")!;
      expect(sys1.name).toBe("S1-branch"); // branch change applied
      expect(sys1.containers![0].description).toBe("updated on main"); // target change preserved
      expect(sys1.containers![0].components![0].id).toBe("comp1");
      expect(ws.relationships.map((r) => r.id).sort()).toEqual(["r1", "r2"]);

      const mergeEv = events.find((e) => e.op === "merge");
      expect(mergeEv).toBeDefined();
      expect((mergeEv!.payload as C4MergePlan).branch).toBe("feature");
    });

    test("planMerge flags conflicts and applyMerge throws without mutating into", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "base" }, "main");
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "main", "local");

      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.updateElement("sys1", { name: "branch-name" }, "feature", "local");
      BaseCfour.updateElement("sys1", { name: "main-name" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts).toContain("sys1");

      const before = JSON.stringify(BaseCfour.getWorkspace("main"));
      expect(() => BaseCfour.applyMerge(plan, "main")).toThrow(/conflict/i);
      // into is completely untouched when conflicts are present
      expect(JSON.stringify(BaseCfour.getWorkspace("main"))).toBe(before);
      expect(BaseCfour.getWorkspace("main").softwareSystems[0].name).toBe("main-name");
    });

    test("branchWorkspace throws when the branch exists; planMerge throws without a base", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.branchWorkspace("main", "feature");
      expect(() => BaseCfour.branchWorkspace("main", "feature")).toThrow(/already exists/);
      expect(() => BaseCfour.planMerge("main", "feature")).toThrow(/no recorded base revision/);
    });

    test("applyMerge honors claims — a hand-crafted plan cannot bypass enforcement", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "feature");
      BaseCfour.addRelationship(
        { id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2" },
        "feature",
        "local",
      );

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts).toHaveLength(0);

      // Someone holds an active claim on the merge's destination endpoint.
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob", "main");

      // The plan applies under the reserved system identity, which does not
      // hold bob's claim — the merge is rejected and rolls back atomically.
      expect(() => BaseCfour.applyMerge(plan, "main")).toThrow(/claimed by editor "bob"/);
      expect(BaseCfour.getWorkspace("main").softwareSystems.map((s) => s.id)).toEqual(["sys1"]);
      expect(BaseCfour.getWorkspace("main").relationships).toHaveLength(0);

      // After the claim is released, the same plan applies cleanly.
      BaseCfour.releaseAllClaimsFor("bob", "main");
      BaseCfour.applyMerge(plan, "main");
      expect(BaseCfour.getWorkspace("main").relationships.map((r) => r.id)).toEqual(["r1"]);
    });

    test("planMerge reports claimBlockers for branch-touched ids claimed in the target", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "feature");

      // Unclaimed target: no blockers.
      let plan = BaseCfour.planMerge("feature", "main");
      expect(plan.claimBlockers).toEqual([]);

      // Claim the id the branch adds → the holder shows up as a blocker.
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob", "main");
      plan = BaseCfour.planMerge("feature", "main");
      expect(plan.claimBlockers).toEqual([{ elementId: "sys2", holderEditorId: "bob" }]);
      expect(plan.conflicts).toEqual([]); // claims are not conflicts
    });

    test("claimBlockers are independent of conflicts", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      // sys1 changed on both sides → a conflict, but nobody claims it.
      BaseCfour.updateElement("sys1", { name: "branch-name" }, "feature", "local");
      BaseCfour.updateElement("sys1", { name: "main-name" }, "main", "local");
      // sys2 added only on the branch, but claimed on the target → a blocker.
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "feature");
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob", "main");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts).toEqual(["sys1"]);
      expect(plan.claimBlockers).toEqual([{ elementId: "sys2", holderEditorId: "bob" }]);
    });
  });

  describe("Add event payload", () => {
    test("every add event carries the created element in `after`", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "sys" });
      BaseCfour.addPerson({ id: "p1", name: "P1" });
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "default", "local");
      BaseCfour.addComponent(
        { id: "comp1", name: "Comp1", containerId: "con1" },
        "default",
        "local",
      );
      BaseCfour.addCodeElement(
        { id: "ce1", name: "CE1", componentId: "comp1" },
        "default",
        "local",
      );
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        { id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2" },
        "default",
        "local",
      );

      const byId = new Map(events.map((e) => [e.elementId, e]));
      expect((byId.get("sys1")!.after as C4Node).kind).toBe("SoftwareSystem");
      expect((byId.get("sys1")!.after as C4Node).name).toBe("S1");
      expect((byId.get("p1")!.after as C4Node).kind).toBe("Person");
      expect((byId.get("con1")!.after as C4Node).kind).toBe("Container");
      expect((byId.get("comp1")!.after as C4Node).kind).toBe("Component");
      expect((byId.get("ce1")!.after as C4Node).kind).toBe("Class");
      const relAfter = byId.get("r1")!.after as unknown as C4Relationship;
      expect(relAfter.id).toBe("r1");
      expect(relAfter.sourceId).toBe("sys1");
      unsub();
    });
  });

  describe("Row persistence round-trip", () => {
    test("exportRows -> rowsToWorkspace reproduces an identical workspace (zero-change diff)", () => {
      BaseCfour.addSoftwareSystem({
        id: "sys1",
        name: "S1",
        description: "sys",
        tags: ["a", "b"],
        metadata: { repo: "acme" },
      });
      BaseCfour.addPerson({ id: "p1", name: "P1", external: true });
      BaseCfour.addContainer(
        { id: "con1", name: "C1", systemId: "sys1", technology: "Go" },
        "default",
        "local",
      );
      BaseCfour.addComponent(
        { id: "comp1", name: "Comp1", containerId: "con1", behavior: "auth" },
        "default",
        "local",
      );
      BaseCfour.addCodeElement(
        {
          id: "ce1",
          name: "CE1",
          componentId: "comp1",
          stereotype: "interface",
          namespace: "acme",
        },
        "default",
        "local",
      );
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          description: "calls",
          technology: "http",
        },
        "default",
        "local",
      );

      const original = BaseCfour.getWorkspace();
      const rows = BaseCfour.exportRows();

      // Flattening is lossless at the row level: JSON fields round-trip.
      const sysRow = rows.nodes.find((n) => n.id === "sys1");
      expect(sysRow?.tags).toBe(JSON.stringify(["a", "b"]));
      expect(sysRow?.metadata).toBe(JSON.stringify({ repo: "acme" }));
      expect(sysRow?.kind).toBe("SoftwareSystem");
      expect(rows.nodes.find((n) => n.id === "p1")?.external).toBe(1);
      expect(rows.nodes.find((n) => n.id === "ce1")?.stereotype).toBe("interface");
      expect(rows.relationships[0]).toMatchObject({
        id: "r1",
        source_id: "sys1",
        destination_id: "sys2",
        technology: "http",
      });

      // Nested tree is rebuilt in dependency order with no drift.
      const rebuilt = rowsToWorkspace(rows, "default");
      const diff = diffWorkspaces(original, rebuilt);
      expect(diff.nodes.added).toEqual([]);
      expect(diff.nodes.removed).toEqual([]);
      expect(diff.nodes.modified).toEqual([]);
      expect(diff.relationships.added).toEqual([]);
      expect(diff.relationships.removed).toEqual([]);
      expect(diff.relationships.modified).toEqual([]);
    });

    test("importRows installs a workspace exactly like import(): same rows, event, and title", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addRelationship(
        { id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys1" },
        "default",
        "local",
      );
      const rows = BaseCfour.exportRows();
      BaseCfour.resetWorkspace();
      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.importRows(rows, "default", "Titled", "a description");

      const ws = BaseCfour.getWorkspace();
      expect(ws.name).toBe("Titled");
      expect(ws.description).toBe("a description");
      expect(ws.softwareSystems.map((s) => s.id)).toEqual(["sys1"]);
      expect(ws.relationships.map((r) => r.id)).toEqual(["r1"]);
      expect(events.map((e) => e.op)).toEqual(["import"]);
      unsub();

      // Works in any workspace name — rows carry their own workspace_name but
      // the target wins.
      BaseCfour.importRows(rows, "renamed");
      expect(BaseCfour.getWorkspace("renamed").softwareSystems.map((s) => s.id)).toEqual(["sys1"]);
    });
  });

  describe("Proposal TTL", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    function seedCrossClaimed(workspaceName: string) {
      BaseCfour.addSoftwareSystem({ id: "src", name: "Src" }, workspaceName);
      BaseCfour.addSoftwareSystem({ id: "dst", name: "Dst" }, workspaceName);
      BaseCfour.claim({ elementIds: ["src"], relationshipIds: [] }, "alice", workspaceName);
      BaseCfour.claim({ elementIds: ["dst"], relationshipIds: [] }, "bob", workspaceName);
    }

    test("expireStaleProposals removes stale proposals by createdAt and returns their ids, emitting nothing", () => {
      seedCrossClaimed("default");
      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "src",
        destinationId: "dst",
        description: "calls",
      };

      const stale = BaseCfour.proposeRelationship(rel, "carol");
      expect(stale.createdAt).toBeDefined();
      expect(stale.createdAt).toBeLessThanOrEqual(Date.now());
      stale.createdAt = Date.now() - 100_000;
      const fresh = BaseCfour.proposeRelationship({ ...rel, id: "r2" }, "carol");

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      const expired = BaseCfour.expireStaleProposals("default", 60_000);
      unsub();

      expect(expired).toEqual([stale.id]);
      expect(BaseCfour.getRelationshipProposals().map((p) => p.id)).toEqual([fresh.id]);
      // Expiry is a silent sweep: no rejectRelationship (or any) events fire.
      expect(events).toHaveLength(0);
    });

    test("setProposalTtl drives the expireStaleProposals default threshold", () => {
      seedCrossClaimed("default");
      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "src",
        destinationId: "dst",
      };
      BaseCfour.setProposalTtl(1);
      const proposal = BaseCfour.proposeRelationship(rel, "carol");
      proposal.createdAt = Date.now() - 1000;
      expect(BaseCfour.expireStaleProposals()).toContain(proposal.id);
      BaseCfour.setProposalTtl(5 * 60 * 1000); // restore default
    });

    test("setProposalTtl per-workspace override wins only in that workspace", () => {
      seedCrossClaimed("main");
      seedCrossClaimed("other");
      BaseCfour.setProposalTtl(5 * 60 * 1000); // reset the instance default
      BaseCfour.setProposalTtl(1, "main");

      const rel = {
        id: "r1",
        kind: "Relationship" as const,
        sourceId: "src",
        destinationId: "dst",
      };
      const mainProp = BaseCfour.proposeRelationship(rel, "carol", "main");
      mainProp.createdAt = Date.now() - 1000;
      const otherProp = BaseCfour.proposeRelationship({ ...rel, id: "r2" }, "carol", "other");
      otherProp.createdAt = Date.now() - 1000;

      expect(BaseCfour.expireStaleProposals("main")).toEqual([mainProp.id]);
      expect(BaseCfour.expireStaleProposals("other")).toEqual([]);
      BaseCfour.setProposalTtl(5 * 60 * 1000); // restore default
    });
  });

  describe("Structured conflict resolution", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("resolveMerge with mixed branch/target resolutions yields the expected final workspace", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "base" }, "main");
      BaseCfour.addContainer({ id: "con1", name: "C1", systemId: "sys1" }, "main", "local");
      BaseCfour.branchWorkspace("main", "feature");

      // sys1: modified on both sides; con1: modified on both sides; sys2: added on branch only.
      BaseCfour.updateElement(
        "sys1",
        { name: "branch-sys", description: "branch-desc" },
        "feature",
        "local",
      );
      BaseCfour.updateElement("con1", { name: "branch-con" }, "feature", "local");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2-branch" }, "feature");
      BaseCfour.updateElement("sys1", { name: "main-sys" }, "main", "local");
      BaseCfour.updateElement("con1", { name: "main-con" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts.sort()).toEqual(["con1", "sys1"]);

      // sys1 → keep target; con1 → take branch.
      const resolved = BaseCfour.resolveMerge(plan, [
        { id: "sys1", take: "target" },
        { id: "con1", take: "branch" },
      ]);
      expect(resolved.conflicts).toEqual([]);
      expect(resolved.resolutions).toEqual([
        { id: "sys1", take: "target" },
        { id: "con1", take: "branch" },
      ]);

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.applyMerge(resolved, "main");
      unsub();

      const ws = BaseCfour.getWorkspace("main");
      expect(ws.softwareSystems.map((s) => s.id).sort()).toEqual(["sys1", "sys2"]);
      const sys1 = ws.softwareSystems.find((s) => s.id === "sys1")!;
      expect(sys1.name).toBe("main-sys"); // target wins for sys1
      expect(sys1.containers![0].name).toBe("branch-con"); // branch wins for con1
      expect(ws.softwareSystems.find((s) => s.id === "sys2")!.name).toBe("S2-branch");
      // Merge events still fire per the applied plan.
      expect(events.filter((e) => e.op === "merge").length).toBe(1);
    });

    test("take target on a removal conflict keeps the element on the target", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.removeElement("sys1", "feature", "local");
      BaseCfour.updateElement("sys1", { name: "kept" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts).toEqual(["sys1"]);
      const resolved = BaseCfour.resolveMerge(plan, [{ id: "sys1", take: "target" }]);
      BaseCfour.applyMerge(resolved, "main");

      const sys1 = BaseCfour.getWorkspace("main").softwareSystems.find((s) => s.id === "sys1");
      expect(sys1).toBeDefined();
      expect(sys1!.name).toBe("kept");
    });

    test("a fully branch-resolved plan applies every branch change", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1", description: "base" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.updateElement("sys1", { name: "branch-name" }, "feature", "local");
      BaseCfour.updateElement("sys1", { name: "main-name" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      const resolved = BaseCfour.resolveMerge(plan, [{ id: "sys1", take: "branch" }]);
      BaseCfour.applyMerge(resolved, "main");
      expect(BaseCfour.getWorkspace("main").softwareSystems[0].name).toBe("branch-name");
    });

    test("resolveMerge throws on an unresolved conflict id and on an unknown resolution id", () => {
      BaseCfour.resetWorkspace("main", "Main");
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "main");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "main");
      BaseCfour.branchWorkspace("main", "feature");
      BaseCfour.updateElement("sys1", { name: "b1" }, "feature", "local");
      BaseCfour.updateElement("sys2", { name: "b2" }, "feature", "local");
      BaseCfour.updateElement("sys1", { name: "m1" }, "main", "local");
      BaseCfour.updateElement("sys2", { name: "m2" }, "main", "local");

      const plan = BaseCfour.planMerge("feature", "main");
      expect(plan.conflicts.sort()).toEqual(["sys1", "sys2"]);

      // Only one of the two conflicts resolved.
      expect(() => BaseCfour.resolveMerge(plan, [{ id: "sys1", take: "branch" }])).toThrow(
        /no resolution/,
      );
      // A resolution naming a non-conflict id.
      expect(() =>
        BaseCfour.resolveMerge(plan, [
          { id: "sys1", take: "branch" },
          { id: "sys2", take: "branch" },
          { id: "nope", take: "target" },
        ]),
      ).toThrow(/not a conflict/);
    });
  });

  describe("View events & restoreViews", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("saveView and updateViewPosition events carry elementKind View and the view in after", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      const view = BaseCfour.getSystemContextView("sys1");

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));

      BaseCfour.saveView(view);
      BaseCfour.updateViewPosition(view.id, "sys1", 100, 200);
      unsub();

      const saveEv = events.find((e) => e.op === "add" && e.elementId === view.id);
      expect(saveEv).toBeDefined();
      expect(saveEv!.elementKind).toBe("View");
      expect((saveEv!.after as C4View).id).toBe(view.id);
      expect((saveEv!.after as C4View).elements.length).toBeGreaterThan(0);

      const updateEv = events.find((e) => e.op === "update" && e.elementId === view.id);
      expect(updateEv).toBeDefined();
      expect(updateEv!.elementKind).toBe("View");
      const after = updateEv!.after as C4View;
      expect(after.id).toBe(view.id);
      expect(after.elements.find((ve) => ve.elementId === "sys1")?.x).toBe(100);
      expect(after.elements.find((ve) => ve.elementId === "sys1")?.y).toBe(200);
    });

    test("restoreViews replaces the workspace views without emitting events", () => {
      const view: C4View = {
        id: "ctx-1",
        kind: "SystemContext",
        title: "Context",
        elements: [{ elementId: "sys1", x: 1, y: 2 }],
        relationships: [],
      };

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.restoreViews([view]);
      unsub();

      const restored = BaseCfour.getWorkspace().views![0];
      expect(restored.id).toBe("ctx-1");
      expect(restored.elements).toEqual([{ elementId: "sys1", x: 1, y: 2 }]);
      expect(events).toHaveLength(0);

      // Mutating the caller's view does not alias the workspace's copy.
      view.elements.push({ elementId: "other" });
      expect(BaseCfour.getWorkspace().views![0].elements).toHaveLength(1);
    });
  });

  describe("Batch Operations (applyOperations)", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("applies a mixed batch atomically and emits every mutation event", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.applyOperations([
        { op: "addSoftwareSystem", args: [{ id: "sys1", name: "S1" }] },
        { op: "addContainer", args: [{ id: "con1", name: "C1", systemId: "sys1" }] },
        { op: "addComponent", args: [{ id: "comp1", name: "P1", containerId: "con1" }] },
        { op: "addCodeElement", args: [{ id: "cls1", name: "K1", componentId: "comp1" }] },
        { op: "updateElement", args: ["sys1", { name: "S1-renamed" }] },
      ]);
      unsub();

      const ws = BaseCfour.getWorkspace();
      expect(ws.softwareSystems[0].name).toBe("S1-renamed");
      expect(ws.softwareSystems[0].containers![0].components![0].codeElements![0].id).toBe("cls1");
      // Four adds + one update, each flushed in order.
      expect(events.filter((e) => e.op === "add").length).toBe(4);
      expect(events.filter((e) => e.op === "update").length).toBe(1);
    });

    test("mid-batch failure rolls everything back and rethrows without events", () => {
      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      expect(() =>
        BaseCfour.applyOperations([
          { op: "addSoftwareSystem", args: [{ id: "sys1", name: "S1" }] },
          // The container's parent does not exist → throws mid-batch.
          { op: "addContainer", args: [{ id: "con1", name: "C1", systemId: "missing" }] },
        ]),
      ).toThrow(/not found/i);
      unsub();

      expect(BaseCfour.getWorkspace().softwareSystems).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    test("claim enforcement applies per op", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "bob");
      expect(() =>
        BaseCfour.applyOperations(
          [{ op: "updateElement", args: ["sys1", { name: "S1-hacked" }] }],
          "default",
          "alice",
        ),
      ).toThrow(/claimed by editor "bob"/);
      expect(BaseCfour.getWorkspace().softwareSystems[0].name).toBe("S1");
    });

    test("removeRelationship op removes a relationship through the public mutator", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" });
      BaseCfour.addRelationship(
        {
          id: "r1",
          kind: "Relationship",
          sourceId: "sys1",
          destinationId: "sys2",
          description: "uses",
        },
        "default",
        "local",
      );

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.applyOperations([{ op: "removeRelationship", args: ["r1"] }]);
      unsub();

      expect(BaseCfour.getWorkspace().relationships).toHaveLength(0);
      const removeEv = events.find((e) => e.op === "remove" && e.elementId === "r1");
      expect(removeEv?.elementKind).toBe("Relationship");
    });
  });

  describe("Branch lineage persistence", () => {
    test("getBranchBase exposes what branchWorkspace recorded; restoreBranchBase rehydrates it", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" });
      BaseCfour.branchWorkspace("default", "lin-feature");
      BaseCfour.addSoftwareSystem({ id: "feat", name: "F" }, "lin-feature");

      const base = BaseCfour.getBranchBase("lin-feature");
      expect(base).toBeDefined();
      expect(base!.parent).toBe("default");
      expect(
        (JSON.parse(base!.baseSnapshot) as C4Workspace).softwareSystems.map((s) => s.id),
      ).toEqual(["sys1"]);

      // A fresh instance is lineage-less until restoreBranchBase — the exact
      // cold-start path the storage layer (WorkspaceDO) follows.
      const fresh = new BaseCfour();
      expect(fresh.getBranchBase("lin-feature")).toBeUndefined();
      fresh.importRows(BaseCfour.exportRows("default"), "default");
      fresh.importRows(BaseCfour.exportRows("lin-feature"), "lin-feature");
      fresh.restoreBranchBase("lin-feature", base!.parent, base!.baseSnapshot);

      const plan = fresh.planMerge("lin-feature", "default");
      expect(plan.branch).toBe("lin-feature");
      expect(plan.into).toBe("default");
      expect(plan.conflicts).toEqual([]);
      expect(plan.branchChanges.nodes.added.map((n) => n.id)).toEqual(["feat"]);

      fresh.applyMerge(plan, "default");
      expect(
        fresh
          .getWorkspace("default")
          .softwareSystems.map((s) => s.id)
          .sort(),
      ).toEqual(["feat", "sys1"]);
    });
  });

  describe("deleteWorkspace", () => {
    beforeEach(() => {
      BaseCfour.reset();
    });

    test("removes the workspace, its own lineage, claims and proposals without events", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "del-main");
      BaseCfour.addSoftwareSystem({ id: "sys2", name: "S2" }, "del-main");
      BaseCfour.branchWorkspace("del-main", "del-feature");
      BaseCfour.claim({ elementIds: ["sys1"], relationshipIds: [] }, "alice", "del-main");
      BaseCfour.claim({ elementIds: ["sys2"], relationshipIds: [] }, "bob", "del-main");
      BaseCfour.proposeRelationship(
        { id: "r1", kind: "Relationship", sourceId: "sys1", destinationId: "sys2" },
        "alice",
        "del-main",
      );

      const events: CfourChangeEvent[] = [];
      const unsub = BaseCfour.subscribe((e) => events.push(e));
      BaseCfour.deleteWorkspace("del-main");
      unsub();

      expect(BaseCfour.getWorkspaceNames()).not.toContain("del-main");
      expect(BaseCfour.getClaims("del-main")).toEqual([]);
      expect(BaseCfour.getRelationshipProposals("del-main")).toEqual([]);
      expect(events).toHaveLength(0);
    });

    test("an unrelated workspace is untouched and a fresh workspace is lazily recreated", () => {
      BaseCfour.addSoftwareSystem({ id: "s1", name: "S1" }, "keep");
      BaseCfour.addSoftwareSystem({ id: "gone", name: "Gone" }, "doomed");
      BaseCfour.deleteWorkspace("doomed");

      expect(BaseCfour.getWorkspaceNames().sort()).toEqual(["default", "keep"]);
      expect(BaseCfour.getWorkspace("keep").softwareSystems.map((s) => s.id)).toEqual(["s1"]);
      expect(BaseCfour.getWorkspace("doomed").softwareSystems).toEqual([]);
    });

    test("deleting a branch parent leaves the derived branch workspace and lineage intact", () => {
      BaseCfour.addSoftwareSystem({ id: "sys1", name: "S1" }, "parent-ws");
      BaseCfour.branchWorkspace("parent-ws", "child-branch");
      BaseCfour.addSoftwareSystem({ id: "feat", name: "F" }, "child-branch");

      BaseCfour.deleteWorkspace("parent-ws");

      // The host refuses to delete a branch parent (v1); cfour leaves the
      // derived branch's content and lineage alone so that guard is the only
      // gate.
      expect(BaseCfour.getWorkspaceNames().sort()).toEqual(["child-branch", "default"]);
      expect(BaseCfour.getBranchBase("child-branch")).toBeDefined();
      expect(BaseCfour.getWorkspace("child-branch").softwareSystems.map((s) => s.id)).toEqual([
        "sys1",
        "feat",
      ]);
    });
  });
});
