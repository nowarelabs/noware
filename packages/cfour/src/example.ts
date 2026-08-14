// ============================================================
// Example — Online Banking System (from the C4 model website)
// ============================================================

import {
  c4ToReactFlow,
  buildSystemContextView,
  buildContainerView,
  buildComponentView,
  buildCodeView,
} from "./index.ts";
import type { C4Workspace, C4ReactFlowNode, C4ReactFlowEdge } from "./index.ts";

// ----------------------------------------------------------------
// 1. Define the workspace (Levels 1–4)
// ----------------------------------------------------------------

const workspace: C4Workspace = {
  name: "Online Banking System",
  description: "Allows customers to view account balances and make payments.",

  people: [
    {
      id: "customer",
      kind: "Person",
      name: "Personal Banking Customer",
      description: "A customer of the bank with personal accounts.",
    },
    {
      id: "backoffice",
      kind: "Person",
      name: "Back Office Staff",
      description: "Bank employees who manage customer accounts.",
    },
  ],

  softwareSystems: [
    {
      id: "banking-system",
      kind: "SoftwareSystem",
      name: "Internet Banking System",
      description: "Allows customers to view account info and make payments.",
      containers: [
        {
          id: "web-app",
          kind: "Container",
          systemId: "banking-system",
          name: "Web Application",
          description: "Delivers the static content and the SPA.",
          technology: "Nginx / React",
          components: [
            {
              id: "signin-controller",
              kind: "Component",
              containerId: "web-app",
              name: "Sign In Controller",
              description: "Handles sign-in requests.",
              technology: "Spring MVC RestController",
            },
          ],
        },
        {
          id: "api",
          kind: "Container",
          systemId: "banking-system",
          name: "API Application",
          description: "Provides internet banking via a JSON/HTTPS API.",
          technology: "Java / Spring Boot",
          components: [
            {
              id: "accounts-controller",
              kind: "Component",
              containerId: "api",
              name: "Accounts Controller",
              description: "Exposes account summary endpoints.",
              technology: "Spring MVC @RestController",
              // ── Level 4: code elements inside this component ──
              codeElements: [
                {
                  id: "IAccountsRepository",
                  kind: "Interface",
                  componentId: "accounts-controller",
                  name: "IAccountsRepository",
                  namespace: "com.bank.accounts",
                  stereotype: "<<repository>>",
                  members: [
                    {
                      kind: "method",
                      name: "findById",
                      type: "Optional<Account>",
                      visibility: "public",
                      parameters: "(id: UUID)",
                    },
                    {
                      kind: "method",
                      name: "findAllByCustomer",
                      type: "List<Account>",
                      visibility: "public",
                      parameters: "(customerId: UUID)",
                    },
                  ],
                },
                {
                  id: "AccountsRepositoryImpl",
                  kind: "Class",
                  componentId: "accounts-controller",
                  name: "AccountsRepositoryImpl",
                  namespace: "com.bank.accounts.impl",
                  stereotype: "@Repository",
                  members: [
                    {
                      kind: "field",
                      name: "dataSource",
                      type: "DataSource",
                      visibility: "private",
                    },
                    {
                      kind: "constructor",
                      name: "AccountsRepositoryImpl",
                      visibility: "public",
                      parameters: "(dataSource: DataSource)",
                    },
                    {
                      kind: "method",
                      name: "findById",
                      type: "Optional<Account>",
                      visibility: "public",
                      parameters: "(id: UUID)",
                    },
                    {
                      kind: "method",
                      name: "findAllByCustomer",
                      type: "List<Account>",
                      visibility: "public",
                      parameters: "(customerId: UUID)",
                    },
                  ],
                },
                {
                  id: "Account",
                  kind: "Class",
                  componentId: "accounts-controller",
                  name: "Account",
                  namespace: "com.bank.accounts.model",
                  stereotype: "<<entity>>",
                  members: [
                    { kind: "field", name: "id", type: "UUID", visibility: "private" },
                    { kind: "field", name: "customerId", type: "UUID", visibility: "private" },
                    { kind: "field", name: "balance", type: "BigDecimal", visibility: "private" },
                    { kind: "field", name: "currency", type: "Currency", visibility: "private" },
                    {
                      kind: "method",
                      name: "getId",
                      type: "UUID",
                      visibility: "public",
                      parameters: "()",
                    },
                    {
                      kind: "method",
                      name: "getBalance",
                      type: "BigDecimal",
                      visibility: "public",
                      parameters: "()",
                    },
                  ],
                },
                {
                  id: "AccountType",
                  kind: "Enum",
                  componentId: "accounts-controller",
                  name: "AccountType",
                  namespace: "com.bank.accounts.model",
                  members: [
                    { kind: "field", name: "CURRENT", type: "AccountType", visibility: "public" },
                    { kind: "field", name: "SAVINGS", type: "AccountType", visibility: "public" },
                    { kind: "field", name: "MORTGAGE", type: "AccountType", visibility: "public" },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "db",
          kind: "Container",
          systemId: "banking-system",
          name: "Database",
          description: "Stores user credentials, audit logs, and account data.",
          technology: "Oracle 12c",
        },
      ],
    },
    {
      id: "email-system",
      kind: "SoftwareSystem",
      name: "E-mail System",
      description: "The internal Microsoft Exchange email system.",
      external: true,
    },
    {
      id: "mainframe",
      kind: "SoftwareSystem",
      name: "Mainframe Banking System",
      description: "Stores core banking info about customers, accounts, transactions.",
      external: true,
    },
  ],

  relationships: [
    // Level 1
    {
      id: "r1",
      kind: "Relationship",
      sourceId: "customer",
      destinationId: "banking-system",
      description: "Views balances and makes payments using",
      technology: "HTTPS",
    },
    {
      id: "r2",
      kind: "Relationship",
      sourceId: "banking-system",
      destinationId: "email-system",
      description: "Sends emails using",
      interactionStyle: "async",
    },
    {
      id: "r3",
      kind: "Relationship",
      sourceId: "banking-system",
      destinationId: "mainframe",
      description: "Gets account information from",
      technology: "XML/HTTPS",
    },
    // Level 2
    {
      id: "r4",
      kind: "Relationship",
      sourceId: "customer",
      destinationId: "web-app",
      description: "Visits bigbank.com using",
      technology: "HTTPS",
    },
    {
      id: "r5",
      kind: "Relationship",
      sourceId: "web-app",
      destinationId: "api",
      description: "Makes API calls to",
      technology: "JSON/HTTPS",
    },
    {
      id: "r6",
      kind: "Relationship",
      sourceId: "api",
      destinationId: "db",
      description: "Reads from and writes to",
      technology: "JDBC",
    },
    {
      id: "r7",
      kind: "Relationship",
      sourceId: "api",
      destinationId: "mainframe",
      description: "Makes API calls to",
      technology: "XML/HTTPS",
    },
    // Level 4 — structural relationships between code elements
    {
      id: "r8",
      kind: "Relationship",
      sourceId: "AccountsRepositoryImpl",
      destinationId: "IAccountsRepository",
      codeRelationshipKind: "Implements",
      description: "implements",
    },
    {
      id: "r9",
      kind: "Relationship",
      sourceId: "AccountsRepositoryImpl",
      destinationId: "Account",
      codeRelationshipKind: "Depends",
      description: "creates / returns",
    },
    {
      id: "r10",
      kind: "Relationship",
      sourceId: "Account",
      destinationId: "AccountType",
      codeRelationshipKind: "Associates",
      description: "has type",
    },
  ],
};

// ----------------------------------------------------------------
// 2. System Context view  (Level 1)
// ----------------------------------------------------------------

const contextView = buildSystemContextView(workspace, "banking-system");
const { nodes: contextNodes, edges: contextEdges } = c4ToReactFlow(workspace, contextView);
console.log(`System Context — ${contextNodes.length} nodes, ${contextEdges.length} edges`);

// ----------------------------------------------------------------
// 3. Container view  (Level 2)
// ----------------------------------------------------------------

const containerView = buildContainerView(workspace, "banking-system");
const { nodes: containerNodes } = c4ToReactFlow(workspace, containerView);
console.log(`Container — ${containerNodes.length} nodes`);

// ----------------------------------------------------------------
// 4. Component view  (Level 3)
// ----------------------------------------------------------------

const componentView = buildComponentView(workspace, "api");
const { nodes: componentNodes } = c4ToReactFlow(workspace, componentView);
console.log(`Component — ${componentNodes.length} nodes`);

// ----------------------------------------------------------------
// 5. Code view  (Level 4)
// ----------------------------------------------------------------

const codeView = buildCodeView(workspace, "accounts-controller");
const { nodes: codeNodes, edges: codeEdges } = c4ToReactFlow(workspace, codeView, {
  // For code views, adjust node height dynamically based on member count
  nodeTransformer: (node, _el) => {
    const memberCount = node.data.members?.length ?? 0;
    const memberRowHeight = 22;
    const headerHeight = 60;
    return {
      ...node,
      height: headerHeight + memberCount * memberRowHeight,
    };
  },
  // Drive UML arrow style from codeRelationshipKind
  edgeTransformer: (edge, rel) => {
    const kind = rel.codeRelationshipKind;
    return {
      ...edge,
      // dashed for Implements / Depends / Realizes
      style:
        kind === "Implements" || kind === "Depends" || kind === "Realizes"
          ? { strokeDasharray: "6 3" }
          : {},
      // animated for async (none at code level, but supported)
      animated: rel.interactionStyle === "async",
    };
  },
});

console.log(`\n=== Code view for 'accounts-controller' ===`);
codeNodes.forEach((n: C4ReactFlowNode) => {
  const memberCount = n.data.members?.length ?? 0;
  console.log(
    `  [${n.data.kind}] ${n.data.name}  (${memberCount} members)  ns: ${n.data.namespace ?? "—"}`,
  );
});
console.log(`Edges:`);
codeEdges.forEach((e: C4ReactFlowEdge) =>
  console.log(`  ${e.source} --[${e.data?.codeRelationshipKind}]--> ${e.target}`),
);

// ----------------------------------------------------------------
// 6. Registering node types in React Flow (illustrative)
// ----------------------------------------------------------------
//
// import ReactFlow from "reactflow";
//
// const nodeTypes = {
//   // Levels 1–3
//   Person:         PersonNode,
//   SoftwareSystem: SoftwareSystemNode,
//   Container:      ContainerNode,
//   Component:      ComponentNode,
//   // Level 4
//   Class:          ClassNode,         // renders stereotype + member list
//   Interface:      InterfaceNode,
//   AbstractClass:  AbstractClassNode,
//   Enum:           EnumNode,
//   Function:       FunctionNode,
//   Table:          TableNode,
//   Object:         ObjectNode,
// };
//
// <ReactFlow nodes={codeNodes} edges={codeEdges} nodeTypes={nodeTypes} />

// ----------------------------------------------------------------
// 7. Code generation (planAndApply) — moved to @nowarelabs/gen-diesel
// ----------------------------------------------------------------
// The generative DSL / codegen pipeline now lives in `@nowarelabs/gen-diesel`
// (`createDiesel` / `defaultDiesel`, `CodebaseFs`, `@nowarelabs/gen-diesel/node`).
// This example deliberately stays a pure model + views demo so cfour remains
// free of node builtins. See `packages/gen-diesel/examples/example.ts` for the
// full plan/apply demo.
