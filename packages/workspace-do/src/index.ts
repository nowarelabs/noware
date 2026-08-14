import { DurableObject } from "cloudflare:workers";
import {
  BaseCfour,
  type C4Claim,
  type C4Node,
  type C4Relationship,
  type C4RelationshipProposal,
  type CfourChangeEvent,
  type NodeRow,
  type RelationshipRow,
  nodeToRow,
  relationshipToRow,
} from "@nowarelabs/cfour";

export interface Env {
  WORKSPACE_DO: DurableObjectNamespace<WorkspaceDO>;
}

/**
 * Idempotent form of cfour-do-schema.sql — safe to run on every cold start.
 * One DO per project; branches are rows (`workspace_name` column).
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_name TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS branch_base (
  branch_name TEXT PRIMARY KEY, parent_name TEXT NOT NULL,
  base_snapshot TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  workspace_name TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL,
  name TEXT NOT NULL, description TEXT, owner TEXT, icon TEXT, tags TEXT, metadata TEXT,
  parent_id TEXT, technology TEXT, external INTEGER, behavior TEXT,
  stereotype TEXT, namespace TEXT, members TEXT,
  PRIMARY KEY (workspace_name, id)
);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes (workspace_name, parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes (workspace_name, kind);
CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes (workspace_name, owner);
CREATE INDEX IF NOT EXISTS idx_nodes_tech ON nodes (workspace_name, technology);
CREATE TABLE IF NOT EXISTS relationships (
  workspace_name TEXT NOT NULL, id TEXT NOT NULL, source_id TEXT NOT NULL,
  destination_id TEXT NOT NULL, description TEXT, technology TEXT,
  interaction_style TEXT, code_relationship_kind TEXT, tags TEXT,
  PRIMARY KEY (workspace_name, id)
);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships (workspace_name, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_dest ON relationships (workspace_name, destination_id);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY, workspace_name TEXT NOT NULL, editor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS claim_elements (
  claim_id TEXT NOT NULL, element_id TEXT NOT NULL, PRIMARY KEY (claim_id, element_id)
);
CREATE INDEX IF NOT EXISTS idx_claim_elements_lookup ON claim_elements (element_id);
CREATE TABLE IF NOT EXISTS claim_relationships (
  claim_id TEXT NOT NULL, relationship_id TEXT NOT NULL, PRIMARY KEY (claim_id, relationship_id)
);
CREATE INDEX IF NOT EXISTS idx_claim_rels_lookup ON claim_relationships (relationship_id);
CREATE TABLE IF NOT EXISTS relationship_proposals (
  id TEXT PRIMARY KEY, workspace_name TEXT NOT NULL, relationship TEXT NOT NULL,
  proposer_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS proposal_pending_approvals (
  proposal_id TEXT NOT NULL, editor_id TEXT NOT NULL, PRIMARY KEY (proposal_id, editor_id)
);
`;

const ALARM_INTERVAL_MS = 60_000;
const DEFAULT_WORKSPACE = "default";

/**
 * A Durable Object that runs one `BaseCfour` instance per project, persisting
 * every mutation to SQLite storage. Branches share the same DO — they are
 * rows keyed by `workspace_name`, which is the only way planMerge/applyMerge
 * can stay atomic within a single cfour instance.
 *
 * Persistence is driven entirely by `BaseCfour`'s own change events (see
 * `persist`) — there is no separate "save" call. Cold starts rehydrate each
 * workspace from its rows on first touch (see `hydrate`).
 */
export class WorkspaceDO extends DurableObject<Env> {
  private readonly cfour = new BaseCfour();
  private readonly hydrated = new Set<string>();
  private readonly _workspaceLocks = new Map<string, Promise<unknown>>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // blockConcurrencyWhile: the runtime refuses to deliver RPCs/events until
    // this callback resolves, so the schema is guaranteed present (and the
    // expiry alarm scheduled) before the first request runs.
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(SCHEMA);
      const existing = await this.ctx.storage.getAlarm();
      if (!existing) await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    });
    // Every mutation to any workspace in this instance flows through here.
    // This is the entire sync mechanism — no separate "save" call anywhere.
    this.cfour.subscribe((event) => this.persist(event));
  }

  // ── Cold-start hydration ────────────────────────────────────────────
  // getWorkspace() would otherwise silently fabricate an empty workspace if
  // it's not yet in memory, masking the fact that rows already exist in
  // SQLite. Always hydrate before touching a name.

  private hydrate(workspaceName: string) {
    if (this.hydrated.has(workspaceName)) return;
    this.hydrated.add(workspaceName);

    const meta = [
      ...this.ctx.storage.sql.exec<{ title: string; description: string | null }>(
        `SELECT title, description FROM workspaces WHERE workspace_name = ?`,
        workspaceName,
      ),
    ][0];
    if (!meta) return; // genuinely new — let the first write create it

    const nodes = [
      ...this.ctx.storage.sql.exec<NodeRow>(
        `SELECT * FROM nodes WHERE workspace_name = ?`,
        workspaceName,
      ),
    ];
    const relationships = [
      ...this.ctx.storage.sql.exec<RelationshipRow>(
        `SELECT * FROM relationships WHERE workspace_name = ?`,
        workspaceName,
      ),
    ];
    this.cfour.importRows(
      { nodes, relationships },
      workspaceName,
      meta.title,
      meta.description ?? undefined,
    );

    // Claims, proposals and branch lineage survive restarts too; they are not
    // part of the node/relationship rows importRows installs.
    this.restoreClaims(workspaceName);
    this.restoreProposals(workspaceName);
    this.restoreBranchBases(workspaceName);
  }

  private restoreClaims(workspaceName: string) {
    const rows = [
      ...this.ctx.storage.sql.exec<{
        id: string;
        editor_id: string;
        created_at: number;
        last_seen_at: number;
      }>(
        `SELECT id, editor_id, created_at, last_seen_at FROM claims WHERE workspace_name = ?`,
        workspaceName,
      ),
    ];
    if (!rows.length) return;
    const claims: C4Claim[] = rows.map((row) => ({
      id: row.id,
      editorId: row.editor_id,
      workspaceName,
      elementIds: new Set<string>(),
      relationshipIds: new Set<string>(),
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    }));
    for (const r of this.ctx.storage.sql.exec<{ claim_id: string; element_id: string }>(
      `SELECT ce.claim_id, ce.element_id
         FROM claim_elements ce JOIN claims c ON c.id = ce.claim_id
        WHERE c.workspace_name = ?`,
      workspaceName,
    )) {
      claims.find((c) => c.id === r.claim_id)?.elementIds.add(r.element_id);
    }
    for (const r of this.ctx.storage.sql.exec<{ claim_id: string; relationship_id: string }>(
      `SELECT cr.claim_id, cr.relationship_id
         FROM claim_relationships cr JOIN claims c ON c.id = cr.claim_id
        WHERE c.workspace_name = ?`,
      workspaceName,
    )) {
      claims.find((c) => c.id === r.claim_id)?.relationshipIds.add(r.relationship_id);
    }
    this.cfour.restoreClaims(claims, workspaceName);
  }

  private restoreProposals(workspaceName: string) {
    const rows = [
      ...this.ctx.storage.sql.exec<{
        id: string;
        relationship: string;
        proposer_id: string;
        created_at: number;
      }>(
        `SELECT id, relationship, proposer_id, created_at
           FROM relationship_proposals WHERE workspace_name = ?`,
        workspaceName,
      ),
    ];
    if (!rows.length) return;
    const proposals: C4RelationshipProposal[] = rows.map((row) => ({
      id: row.id,
      relationship: JSON.parse(row.relationship) as C4Relationship,
      workspaceName,
      proposerId: row.proposer_id,
      pendingApprovals: new Set(
        [
          ...this.ctx.storage.sql.exec<{ editor_id: string }>(
            `SELECT editor_id FROM proposal_pending_approvals WHERE proposal_id = ?`,
            row.id,
          ),
        ].map((p) => p.editor_id),
      ),
      createdAt: row.created_at,
    }));
    this.cfour.restoreProposals(proposals, workspaceName);
  }

  private restoreBranchBases(workspaceName: string) {
    for (const row of this.ctx.storage.sql.exec<{
      branch_name: string;
      parent_name: string;
      base_snapshot: string;
    }>(
      `SELECT branch_name, parent_name, base_snapshot FROM branch_base WHERE branch_name = ?`,
      workspaceName,
    )) {
      this.cfour.restoreBranchBase(row.branch_name, row.parent_name, row.base_snapshot);
    }
  }

  // ── Incremental persistence, driven by BaseCfour's own events ───────
  // No hand-rolled diffing: BaseCfour already tells us exactly what changed
  // via the same event shape subscribe() has always used.

  private persist(event: CfourChangeEvent) {
    const sql = this.ctx.storage.sql;
    const ws = event.workspaceName;

    switch (event.op) {
      case "add":
      case "update": {
        if (!event.after) break;
        this.ensureWorkspace(ws);
        if (event.elementKind === "Relationship") {
          this.insertRelationshipRow(
            relationshipToRow(event.after as unknown as C4Relationship, ws),
            true,
          );
        } else {
          this.insertNodeRow(nodeToRow(event.after as C4Node, ws), true);
        }
        break;
      }

      case "remove": {
        const removedNodeIds = [
          ...(event.elementKind !== "Relationship" && event.elementId ? [event.elementId] : []),
          ...(event.removedDescendants?.nodes.map((n) => n.id) ?? []),
        ];
        const removedRelIds = [
          ...(event.elementKind === "Relationship" && event.elementId ? [event.elementId] : []),
          ...(event.removedDescendants?.relationships.map((r) => r.id) ?? []),
        ];
        // Deleting from the junction tables by id is independent of which
        // claim (if any) held them — no claim-shrink event needed for this to
        // stay correct, since claim_elements doesn't care who owns a row.
        if (removedNodeIds.length) {
          const qs = removedNodeIds.map(() => "?").join(",");
          sql.exec(
            `DELETE FROM nodes WHERE workspace_name = ? AND id IN (${qs})`,
            ws,
            ...removedNodeIds,
          );
          sql.exec(`DELETE FROM claim_elements WHERE element_id IN (${qs})`, ...removedNodeIds);
        }
        if (removedRelIds.length) {
          const qs = removedRelIds.map(() => "?").join(",");
          sql.exec(
            `DELETE FROM relationships WHERE workspace_name = ? AND id IN (${qs})`,
            ws,
            ...removedRelIds,
          );
          sql.exec(
            `DELETE FROM claim_relationships WHERE relationship_id IN (${qs})`,
            ...removedRelIds,
          );
        }
        break;
      }

      case "reset": {
        // Reset wipes everything the workspace owns: nodes, relationships,
        // claims, proposals and branch lineage.
        sql.exec(`DELETE FROM nodes WHERE workspace_name = ?`, ws);
        sql.exec(`DELETE FROM relationships WHERE workspace_name = ?`, ws);
        sql.exec(`DELETE FROM claims WHERE workspace_name = ?`, ws);
        sql.exec(`DELETE FROM claim_elements WHERE element_id NOT IN (SELECT id FROM claims)`);
        sql.exec(
          `DELETE FROM claim_relationships WHERE relationship_id NOT IN (SELECT id FROM claims)`,
        );
        sql.exec(`DELETE FROM relationship_proposals WHERE workspace_name = ?`, ws);
        sql.exec(
          `DELETE FROM proposal_pending_approvals WHERE proposal_id NOT IN (SELECT id FROM relationship_proposals)`,
        );
        sql.exec(`DELETE FROM branch_base WHERE branch_name = ? OR parent_name = ?`, ws, ws);
        this.upsertWorkspaceMeta(ws);
        break;
      }

      case "import": {
        // Wholesale node/relationship swap — resync from the in-memory
        // workspace. Deliberately does NOT touch claims/proposals/branch
        // lineage: hydrate() drives importRows() on cold start and those
        // states are restored separately (and would be lost if wiped here).
        sql.exec(`DELETE FROM nodes WHERE workspace_name = ?`, ws);
        sql.exec(`DELETE FROM relationships WHERE workspace_name = ?`, ws);
        const rows = this.cfour.exportRows(ws);
        for (const n of rows.nodes) this.insertNodeRow(n, false);
        for (const r of rows.relationships) this.insertRelationshipRow(r, false);
        this.upsertWorkspaceMeta(ws);
        break;
      }

      case "claim": {
        const claim = event.payload as C4Claim;
        sql.exec(
          `INSERT INTO claims (id, workspace_name, editor_id, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
          claim.id,
          ws,
          claim.editorId,
          claim.createdAt,
          claim.lastSeenAt,
        );
        for (const id of claim.elementIds) {
          sql.exec(`INSERT INTO claim_elements (claim_id, element_id) VALUES (?, ?)`, claim.id, id);
        }
        for (const id of claim.relationshipIds) {
          sql.exec(
            `INSERT INTO claim_relationships (claim_id, relationship_id) VALUES (?, ?)`,
            claim.id,
            id,
          );
        }
        break;
      }

      case "release": {
        const claim = event.payload as C4Claim;
        // No ON DELETE CASCADE assumed portable — clear junction rows explicitly.
        sql.exec(`DELETE FROM claim_elements WHERE claim_id = ?`, claim.id);
        sql.exec(`DELETE FROM claim_relationships WHERE claim_id = ?`, claim.id);
        sql.exec(`DELETE FROM claims WHERE id = ?`, claim.id);
        break;
      }

      case "branch": {
        const { branch, from } = event.payload as { branch: string; from: string };
        const base = this.cfour.getBranchBase(branch)!;
        sql.exec(
          `INSERT INTO workspaces (workspace_name, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          branch,
          branch,
          null,
          Date.now(),
          Date.now(),
        );
        sql.exec(
          `INSERT INTO branch_base (branch_name, parent_name, base_snapshot, created_at) VALUES (?, ?, ?, ?)`,
          branch,
          from,
          base.baseSnapshot,
          Date.now(),
        );
        const rows = this.cfour.exportRows(branch);
        for (const n of rows.nodes) this.insertNodeRow(n, false);
        for (const r of rows.relationships) this.insertRelationshipRow(r, false);
        this.hydrated.add(branch);
        break;
      }

      case "proposeRelationship": {
        const p = event.payload as C4RelationshipProposal;
        sql.exec(
          `INSERT INTO relationship_proposals (id, workspace_name, relationship, proposer_id, created_at) VALUES (?, ?, ?, ?, ?)`,
          p.id,
          ws,
          JSON.stringify(p.relationship),
          p.proposerId,
          p.createdAt,
        );
        for (const editorId of p.pendingApprovals) {
          sql.exec(
            `INSERT INTO proposal_pending_approvals (proposal_id, editor_id) VALUES (?, ?)`,
            p.id,
            editorId,
          );
        }
        break;
      }

      case "acceptRelationship":
      case "rejectRelationship": {
        const p = event.payload as C4RelationshipProposal;
        sql.exec(`DELETE FROM proposal_pending_approvals WHERE proposal_id = ?`, p.id);
        sql.exec(`DELETE FROM relationship_proposals WHERE id = ?`, p.id);
        break; // "acceptRelationship" also fires its own "add" event, handled above
      }

      case "merge":
        break; // applyMerge replays as ordinary add/update/remove on `into` — already handled
    }

    this.broadcast(event);
  }

  private ensureWorkspace(workspaceName: string) {
    // Lazily-created workspaces (a bare addComponent("feature", ...)) never
    // emit a "branch" event, so their workspaces meta row has to exist
    // before nodes/relationships reference it — otherwise a restart would
    // orphan the rows.
    const inMemory = this.cfour.getWorkspaceNames().includes(workspaceName);
    const title = inMemory ? this.cfour.getWorkspace(workspaceName).name : workspaceName;
    this.ctx.storage.sql.exec(
      `INSERT INTO workspaces (workspace_name, title, description, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?)
       ON CONFLICT(workspace_name) DO NOTHING`,
      workspaceName,
      title,
      Date.now(),
      Date.now(),
    );
  }

  private upsertWorkspaceMeta(workspaceName: string) {
    const meta = this.cfour.getWorkspace(workspaceName);
    this.ctx.storage.sql.exec(
      `INSERT INTO workspaces (workspace_name, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace_name) DO UPDATE SET
         title = excluded.title, description = excluded.description, updated_at = excluded.updated_at`,
      workspaceName,
      meta.name,
      meta.description ?? null,
      Date.now(),
      Date.now(),
    );
  }

  private insertNodeRow(row: NodeRow, upsert: boolean) {
    this.ctx.storage.sql.exec(
      `INSERT INTO nodes (workspace_name,id,kind,name,description,owner,icon,tags,metadata,parent_id,technology,external,behavior,stereotype,namespace,members)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ${
         upsert
           ? `ON CONFLICT(workspace_name,id) DO UPDATE SET
         name=excluded.name, description=excluded.description, owner=excluded.owner, icon=excluded.icon,
         tags=excluded.tags, metadata=excluded.metadata, parent_id=excluded.parent_id,
         technology=excluded.technology, external=excluded.external, behavior=excluded.behavior,
         stereotype=excluded.stereotype, namespace=excluded.namespace, members=excluded.members`
           : ""
       }`,
      row.workspace_name,
      row.id,
      row.kind,
      row.name,
      row.description,
      row.owner,
      row.icon,
      row.tags,
      row.metadata,
      row.parent_id,
      row.technology,
      row.external,
      row.behavior,
      row.stereotype,
      row.namespace,
      row.members,
    );
  }

  private insertRelationshipRow(row: RelationshipRow, upsert: boolean) {
    this.ctx.storage.sql.exec(
      `INSERT INTO relationships (workspace_name,id,source_id,destination_id,description,technology,interaction_style,code_relationship_kind,tags)
       VALUES (?,?,?,?,?,?,?,?,?)
       ${
         upsert
           ? `ON CONFLICT(workspace_name,id) DO UPDATE SET
         source_id=excluded.source_id, destination_id=excluded.destination_id, description=excluded.description,
         technology=excluded.technology, interaction_style=excluded.interaction_style,
         code_relationship_kind=excluded.code_relationship_kind, tags=excluded.tags`
           : ""
       }`,
      row.workspace_name,
      row.id,
      row.source_id,
      row.destination_id,
      row.description,
      row.technology,
      row.interaction_style,
      row.code_relationship_kind,
      row.tags,
    );
  }

  // ── Per-workspace serialization ──────────────────────────────────────
  // RPCs into the same workspace are serialized (each waits for the previous
  // one's chain), while RPCs into different workspaces never wait on each
  // other. cfour calls are synchronous so nothing can interleave inside a
  // single chain step.

  private runForWorkspace<T>(workspaceName: string, fn: () => T | Promise<T>): Promise<T> {
    const prev = this._workspaceLocks.get(workspaceName) ?? Promise.resolve();
    const run = prev.then(() => fn());
    this._workspaceLocks.set(
      workspaceName,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private runForWorkspaces<T>(
    workspaceNames: Iterable<string>,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const names = [...new Set(workspaceNames)].sort();
    const chain = names.reduce<Promise<unknown>>(
      (acc, name) => this.runForWorkspace(name, () => acc),
      Promise.resolve(),
    );
    return chain.then(() => fn());
  }

  private async mutate<T>(workspaceName: string, fn: () => T | Promise<T>): Promise<T> {
    this.hydrate(workspaceName);
    return this.runForWorkspace(workspaceName, async () => {
      await this.prepareWrite(workspaceName);
      return fn();
    });
  }

  /**
   * Test seam: awaited inside the per-workspace lock before every write.
   * Override in a subclass to prove same-workspace writes serialize while
   * writes into different workspaces proceed concurrently.
   */
  protected async prepareWrite(_workspaceName: string): Promise<void> {}

  // ── RPC surface ─────────────────────────────────────────────────────
  // Callable directly from a Worker: env.WORKSPACE_DO.get(id).addComponent(...)
  // One method per mutator you want to expose; every one hydrates first.

  async addSoftwareSystem(
    system: Parameters<BaseCfour["addSoftwareSystem"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () => this.cfour.addSoftwareSystem(system, workspaceName));
  }

  async addPerson(
    person: Parameters<BaseCfour["addPerson"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () => this.cfour.addPerson(person, workspaceName));
  }

  async addContainer(
    container: Parameters<BaseCfour["addContainer"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.addContainer(container, workspaceName, editorId),
    );
  }

  async addComponent(
    component: Parameters<BaseCfour["addComponent"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.addComponent(component, workspaceName, editorId),
    );
  }

  async addCodeElement(
    codeElement: Parameters<BaseCfour["addCodeElement"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.addCodeElement(codeElement, workspaceName, editorId),
    );
  }

  async addRelationship(
    rel: Parameters<BaseCfour["addRelationship"]>[0],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.addRelationship(rel, workspaceName, editorId),
    );
  }

  async updateElement(
    id: string,
    patch: Parameters<BaseCfour["updateElement"]>[1],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.updateElement(id, patch, workspaceName, editorId),
    );
  }

  async updateRelationship(
    id: string,
    patch: Parameters<BaseCfour["updateRelationship"]>[1],
    workspaceName = DEFAULT_WORKSPACE,
    editorId: string,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.updateRelationship(id, patch, workspaceName, editorId),
    );
  }

  async removeElement(id: string, workspaceName = DEFAULT_WORKSPACE, editorId: string) {
    return this.mutate(workspaceName, () => this.cfour.removeElement(id, workspaceName, editorId));
  }

  async resetWorkspace(workspaceName = DEFAULT_WORKSPACE, title?: string, description?: string) {
    return this.mutate(workspaceName, () =>
      this.cfour.resetWorkspace(workspaceName, title, description),
    );
  }

  async claim(
    selection: Parameters<BaseCfour["claim"]>[0],
    editorId: string,
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () => this.cfour.claim(selection, editorId, workspaceName));
  }

  async touchClaim(claimId: string, workspaceName = DEFAULT_WORKSPACE) {
    this.hydrate(workspaceName);
    return this.runForWorkspace(workspaceName, () => {
      // touchClaim emits no event, so persist() never sees it — update the
      // durable `last_seen_at` here so claim TTLs survive hibernation.
      this.cfour.touchClaim(claimId, workspaceName);
      this.ctx.storage.sql.exec(
        `UPDATE claims SET last_seen_at = ? WHERE id = ?`,
        Date.now(),
        claimId,
      );
    });
  }

  async release(claimId: string, workspaceName = DEFAULT_WORKSPACE) {
    return this.mutate(workspaceName, () => this.cfour.release(claimId, workspaceName));
  }

  async expireStaleClaims(workspaceName = DEFAULT_WORKSPACE, maxAgeMs?: number) {
    this.hydrate(workspaceName);
    return this.runForWorkspace(workspaceName, () =>
      this.cfour.expireStaleClaims(workspaceName, maxAgeMs),
    );
  }

  async setClaimTtl(ttlMs: number) {
    this.cfour.setClaimTtl(ttlMs);
  }

  async getClaims(workspaceName = DEFAULT_WORKSPACE) {
    this.hydrate(workspaceName);
    return this.cfour.getClaims(workspaceName);
  }

  async proposeRelationship(
    rel: Parameters<BaseCfour["proposeRelationship"]>[0],
    editorId: string,
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.proposeRelationship(rel, editorId, workspaceName),
    );
  }

  async acceptRelationship(
    proposalId: string,
    accepterId: string,
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.acceptRelationship(proposalId, accepterId, workspaceName),
    );
  }

  async rejectRelationship(
    proposalId: string,
    editorId: string,
    workspaceName = DEFAULT_WORKSPACE,
  ) {
    return this.mutate(workspaceName, () =>
      this.cfour.rejectRelationship(proposalId, editorId, workspaceName),
    );
  }

  async getRelationshipProposals(workspaceName = DEFAULT_WORKSPACE) {
    this.hydrate(workspaceName);
    return this.cfour.getRelationshipProposals(workspaceName);
  }

  async branchWorkspace(from: string, newBranch: string) {
    this.hydrate(from);
    // The in-memory guard only knows about names seen this process — after a
    // restart a persisted branch is invisible to cfour until hydrated, so the
    // durable truth must be checked too.
    const persisted =
      [...this.ctx.storage.sql.exec(`SELECT 1 FROM workspaces WHERE workspace_name = ?`, newBranch)]
        .length > 0;
    if (persisted) {
      throw new Error(`Workspace with name "${newBranch}" already exists.`);
    }
    return this.runForWorkspaces([from, newBranch], async () => {
      await this.prepareWrite(newBranch);
      this.cfour.branchWorkspace(from, newBranch);
    });
  }

  async planMerge(branch: string, into: string) {
    this.hydrate(branch);
    this.hydrate(into);
    return this.runForWorkspaces([branch, into], () => this.cfour.planMerge(branch, into));
  }

  async applyMerge(plan: Parameters<BaseCfour["applyMerge"]>[0], into: string) {
    this.hydrate(plan.branch);
    this.hydrate(into);
    return this.runForWorkspaces([plan.branch, into], () => this.cfour.applyMerge(plan, into));
  }

  async getWorkspace(workspaceName = DEFAULT_WORKSPACE) {
    this.hydrate(workspaceName);
    return this.cfour.getWorkspace(workspaceName);
  }

  async getWorkspaceNames() {
    return this.cfour.getWorkspaceNames();
  }

  // ── Live updates over hibernatable WebSockets ───────────────────────
  // ctx.acceptWebSocket() means this DO doesn't stay billed/warm while
  // connections sit idle — hibernation and wakeup are automatic.

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let parsed: { type?: string; claimId?: string; workspaceName?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return; // not one of our control messages — ignore
    }
    if (parsed.type !== "touchClaim" || !parsed.claimId) return;
    const workspaceName = parsed.workspaceName ?? DEFAULT_WORKSPACE;
    void this.touchClaim(parsed.claimId, workspaceName).catch(() => {
      try {
        ws.send(JSON.stringify({ type: "claimNotFound", claimId: parsed.claimId, workspaceName }));
      } catch {
        // socket is closing; nothing to do
      }
    });
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    try {
      ws.close();
    } catch {
      // already closed
    }
  }

  private broadcast(event: CfourChangeEvent) {
    const message = JSON.stringify(event, (_key, value) =>
      value instanceof Set ? [...value] : value,
    );
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // connection is mid-close; hibernation manager will clean it up
      }
    }
  }

  // ── Self-scheduled claim expiry ──────────────────────────────────────
  // Replaces "host app must poll expireStaleClaims()" with the DO waking
  // itself up — no external cron needed.

  async alarm() {
    // Iterate the distinct workspaces that actually hold claims — NOT
    // getWorkspaceNames(), which only knows in-memory names and would skip
    // unhydrated workspaces after a restart.
    const workspaceNames = [
      ...this.ctx.storage.sql.exec<{ workspace_name: string }>(
        `SELECT DISTINCT workspace_name FROM claims`,
      ),
    ].map((row) => row.workspace_name);
    for (const workspaceName of workspaceNames) {
      this.hydrate(workspaceName);
      this.runForWorkspace(workspaceName, () => this.cfour.expireStaleClaims(workspaceName)).catch(
        () => undefined,
      );
    }
    await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }
}
