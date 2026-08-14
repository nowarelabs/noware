# @nowarelabs/workspace-do

A Cloudflare Durable Object that runs an [`@nowarelabs/cfour`](https://github.com/nowarelabs/noware) C4 model per project, persisting every mutation to the DO's built-in SQLite storage. One DO instance per project; every workspace (branch) of that project is a set of rows keyed by `workspace_name`.

## How it works

- **One DO per project, not per branch.** `planMerge`/`applyMerge` are only atomic inside a single cfour instance, so all branches of a project share one DO and are differentiated by the `workspace_name` column.
- **Event-driven persistence.** `WorkspaceDO` subscribes to cfour's own change events and writes each one to SQLite — there is no separate "save" call. See `persist`.
- **Cold-start hydration.** On construction the schema is applied inside `ctx.blockConcurrencyWhile()` (so no request/event runs before storage is ready) and the claim-expiry alarm is scheduled. Each workspace is rehydrated from its rows on first touch via `hydrate()`.
- **Per-workspace serialization.** Writes to the same `workspace_name` are serialized behind an async mutex; writes to different workspaces run concurrently. Subclass `prepareWrite()` as a test seam.
- **Hibernation-friendly.** WebSockets are accepted through `ctx.acceptWebSocket()` and claims heartbeat over them, so the DO stays cold while sockets idle.

## Worker wiring

Bind the class in `wrangler.toml`:

```toml
[durable_objects]
bindings = [{ name = "WORKSPACE_DO", class_name = "WorkspaceDO" }]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["WorkspaceDO"]
```

`Env` is exported from this package. Derive one stable DO ID per project via `idFromName()`:

```typescript
import type { Env } from "@nowarelabs/workspace-do";

export default {
  async fetch(request: Request, env: Env) {
    const id = env.WORKSPACE_DO.idFromName("my-project");
    const project = env.WORKSPACE_DO.get(id);

    const ws = await project.getWorkspace("default");
    return Response.json({
      systems: ws.softwareSystems,
      people: ws.people,
      relationships: ws.relationships,
    });
  },
};
```

## Usage Reference

All mutating methods are RPC methods on the DO stub; every workspace operation takes a `workspaceName` (default `"default"`).

### 1. Elements

```typescript
const project = env.WORKSPACE_DO.get(env.WORKSPACE_DO.idFromName("acme"));

await project.addSoftwareSystem({ id: "sys1", name: "Ordering" });
await project.addPerson({ id: "p1", name: "Ada" });
await project.addContainer({ id: "ctr1", name: "API", systemId: "sys1" }, "default", "editor-a");
await project.addComponent(
  { id: "c1", name: "Checkout", containerId: "ctr1" },
  "default",
  "editor-a",
);

await project.updateElement("sys1", { name: "Ordering System" }, "default", "editor-b");
await project.removeElement("c1", "default", "editor-b");
```

Methods that attach children (`addContainer`, `addComponent`, `addCodeElement`, `addRelationship`) require an `editorId`; `updateElement`/`removeElement` too.

### 2. Workspaces and branches

```typescript
await project.getWorkspace("default"); // lazy — creates nothing
await project.getWorkspaceNames(); // in-memory names only

await project.branchWorkspace("default", "feature");
await project.addSoftwareSystem({ id: "feat1", name: "New Thing" }, "feature");

await project.getWorkspace("feature"); // branch content
```

### 3. Merging

```typescript
const plan = await project.planMerge("feature", "default");
if (plan.conflicts.length > 0) {
  // report the conflicting element IDs back to the UI
  throw new Error(`Conflicts: ${plan.conflicts.join(", ")}`);
}
await project.applyMerge(plan, "default");
```

Branch lineage (`branch_base` rows) is durable, so merges can be planned again after a DO restart.

### 4. Claims and relationship proposals

Editors claim elements/relationships before editing them; overlapping claims are rejected:

```typescript
const mine = await project.claim({ elementIds: ["sys1"], relationshipIds: [] }, "editor-a");

await project.release(mine.id); // give it back
const claims = await project.getClaims("default"); // live list
```

Relationships that cross a claim boundary need approval from every overlapping editor:

```typescript
const proposal = await project.proposeRelationship(
  { id: "r1", sourceId: "sys1", destinationId: "sys2", kind: "Relationship" },
  "editor-a",
);
// editor-b holds the overlapping claim, so:
await project.acceptRelationship(proposal.id, "editor-b"); // or rejectRelationship
await project.getRelationshipProposals("default");
```

### 5. Claim TTLs and the alarm

Claims go stale after a configurable TTL; the DO wakes itself on a 60s alarm and expires them across every workspace — no external cron needed:

```typescript
await project.setClaimTtl(60_000); // 60s, applies to all workspaces
await project.touchClaim(claimId); // heartbeat (also via WebSocket)
```

### 6. Live updates over WebSockets

`fetch` upgrades to a hibernatable WebSocket; every cfour change event is broadcast to all connected sockets:

```typescript
const ws = new WebSocket("wss://example.com/project/acme/ws");
ws.onmessage = ({ data }) => {
  const event = JSON.parse(data); // { op: "add" | "update" | "remove", ...element }
};
```

Clients can heartbeat their claim over the socket so the DO stays dormant between events:

```json
{ "type": "touchClaim", "claimId": "claim_123", "workspaceName": "default" }
```

An unknown `claimId` gets a `{ "type": "claimNotFound" }` reply.

### 7. Resetting a workspace

```typescript
await project.resetWorkspace("default", "Fresh Start", "wiped for a new sprint");
```

This is a hard reset — it also wipes claims, relationship proposals, and the workspace's branch lineage (a restarted DO can no longer merge it), so use with care.

## Exports

| Export        | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `WorkspaceDO` | The Durable Object class — extends `DurableObject` with the full cfour API |
| `Env`         | `{ WORKSPACE_DO: DurableObjectNamespace<WorkspaceDO> }` binding contract   |
| `SCHEMA`      | Idempotent SQLite DDL applied on every cold start                          |

## Development

- Install dependencies: `vp install`
- Run the unit tests: `vp test`
- Build the library: `vp pack`
- Check for lint issues: `vp check`
