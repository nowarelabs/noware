import { describe, expect, test } from "vite-plus/test";
import { FlaxInstanceModel } from "../src/models/flax-instance.model.js";
import { FlaxStageModel } from "../src/models/flax-stage.model.js";
import { FlaxHitlModel } from "../src/models/flax-hitl.model.js";

interface MockCall {
  sql: string;
  params: any[];
}

function createMockD1(
  override?: (
    sql: string,
  ) => { first?: () => Promise<any>; all?: () => Promise<{ results: any[] }> } | undefined,
) {
  const calls: MockCall[] = [];

  function mockPrepare(sql: string) {
    calls.push({ sql, params: [] });
    const o = override?.(sql);

    const boundMethods = {
      async run() {
        return { success: true, meta: {} };
      },
      async first() {
        return o?.first ? o.first() : null;
      },
      async all() {
        return o?.all ? o.all() : { results: [] };
      },
    };

    return {
      ...boundMethods,
      bind(...params: any[]) {
        calls[calls.length - 1].params = params;
        return boundMethods;
      },
    };
  }

  return {
    db: { prepare: mockPrepare } as any,
    calls,
  };
}

describe("FlaxInstanceModel", () => {
  test("patchFields generates correct SQL with single field", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxInstanceModel({ db, table: "flax_instances" });

    await model.patchFields("conv-1", { title: "My Project" });

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("UPDATE flax_instances SET");
    expect(calls[0].sql).toContain("title = ?");
    expect(calls[0].sql).toContain("WHERE id = ?");
    expect(calls[0].params).toEqual(["My Project", "conv-1"]);
  });

  test("patchFields generates correct SQL with multiple fields", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxInstanceModel({ db, table: "flax_instances" });

    await model.patchFields("conv-1", {
      currentStage: "coding",
      currentAgent: "coding",
      status: "running",
      lastActivityAt: 12345,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("current_stage = ?");
    expect(calls[0].sql).toContain("current_agent = ?");
    expect(calls[0].sql).toContain("status = ?");
    expect(calls[0].sql).toContain("last_activity_at = ?");
    expect(calls[0].params).toEqual(["coding", "coding", "running", 12345, "conv-1"]);
  });

  test("patchFields does nothing with empty patch", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxInstanceModel({ db, table: "flax_instances" });

    await model.patchFields("conv-1", {});

    expect(calls.length).toBe(0);
  });

  test("listRecent generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxInstanceModel({ db, table: "flax_instances" });

    await model.listRecent();

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("SELECT");
    expect(calls[0].sql).toContain("FROM flax_instances");
    expect(calls[0].sql).toContain("ORDER BY");
  });

  test("findByConversationId generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxInstanceModel({ db, table: "flax_instances" });

    const result = await model.findByConversationId("conv-1");

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("SELECT * FROM flax_instances WHERE id = ?");
    expect(calls[0].params).toEqual(["conv-1"]);
    expect(result).toBeNull();
  });

  test("ensureSchema creates table and adds columns", async () => {
    const { db, calls } = createMockD1((sql) => {
      if (sql.includes("PRAGMA")) {
        return {
          all: async () => ({ results: [{ name: "id" }] }),
        };
      }
      return undefined;
    });

    await FlaxInstanceModel.ensureSchema(db, { reset: true });

    const createTableCall = calls.find((c) => c.sql.includes("CREATE TABLE"));
    expect(createTableCall).toBeDefined();
    expect(createTableCall!.sql).toContain("flax_instances");

    const alterCalls = calls.filter((c) => c.sql.includes("ALTER TABLE"));
    expect(alterCalls.length).toBe(6);
  });

  test("ensureSchema does not add existing columns", async () => {
    const { db, calls } = createMockD1((sql) => {
      if (sql.includes("PRAGMA")) {
        return {
          all: async () => ({
            results: [
              { name: "id" },
              { name: "created_at" },
              { name: "last_seen_at" },
              { name: "title" },
              { name: "origin" },
              { name: "current_stage" },
              { name: "current_agent" },
              { name: "status" },
              { name: "last_activity_at" },
            ],
          }),
        };
      }
      return undefined;
    });

    await FlaxInstanceModel.ensureSchema(db, { reset: true });

    const alterCalls = calls.filter((c) => c.sql.includes("ALTER TABLE"));
    expect(alterCalls.length).toBe(0);
  });
});

describe("FlaxStageModel", () => {
  test("openStage closes existing open stages and inserts new one", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxStageModel({ db, table: "flax_stages" });

    await model.openStage("conv-1", "coding", "coding", "Build feature X");

    expect(calls.length).toBe(4);

    expect(calls[0].sql).toContain("SELECT stage FROM flax_stages");
    expect(calls[0].params).toEqual(["conv-1"]);

    expect(calls[1].sql).toContain("UPDATE flax_stages SET exited_at");
    expect(calls[1].sql).toContain("outcome = COALESCE(outcome, 'completed')");

    expect(calls[2].sql).toContain("COUNT(*)");
    expect(calls[2].params).toEqual(["conv-1", "coding"]);

    expect(calls[3].sql).toContain("INSERT INTO flax_stages");
    expect(calls[3].params[0]).toBe("conv-1");
    expect(calls[3].params[1]).toBe("coding");
    expect(calls[3].params[2]).toBe("coding");
  });

  test("openStage marks re-entry when same stage re-entered", async () => {
    const { db, calls } = createMockD1((sql) => {
      if (sql.includes("SELECT stage")) {
        return { first: async () => ({ stage: "coding" }) };
      }
      if (sql.includes("COUNT")) {
        return { first: async () => ({ n: 1 }) };
      }
      return undefined;
    });

    const model = new FlaxStageModel({ db, table: "flax_stages" });
    await model.openStage("conv-1", "coding", "coding", "detail");

    const insertCall = calls.find((c) => c.sql.includes("INSERT INTO flax_stages"));
    expect(insertCall).toBeDefined();
    expect(insertCall!.params[4]).toBe("\u21a9 returned");
  });

  test("closeOpenStage generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxStageModel({ db, table: "flax_stages" });

    await model.closeOpenStage("conv-1", "completed", "All tests passed");

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("UPDATE flax_stages SET");
    expect(calls[0].sql).toContain("exited_at = COALESCE(exited_at, ?)");
    expect(calls[0].sql).toContain("outcome = COALESCE(outcome, ?)");
    expect(calls[0].sql).toContain("detail = COALESCE(detail, ?)");
    // params: [now, outcome, detail, conversationId]
    expect(calls[0].params[1]).toBe("completed");
    expect(calls[0].params[2]).toBe("All tests passed");
    expect(calls[0].params[3]).toBe("conv-1");
    expect(typeof calls[0].params[0]).toBe("number");
  });

  test("closeOpenStage uses default outcome", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxStageModel({ db, table: "flax_stages" });

    await model.closeOpenStage("conv-1");

    expect(calls[0].params[1]).toBe("completed");
  });

  test("hasOpenStage returns true when stages are open", async () => {
    const { db } = createMockD1((sql) => {
      if (sql.includes("COUNT")) {
        return { first: async () => ({ n: 2 }) };
      }
      return undefined;
    });

    const model = new FlaxStageModel({ db, table: "flax_stages" });
    const result = await model.hasOpenStage("conv-1");
    expect(result).toBe(true);
  });

  test("hasOpenStage returns false when no open stages", async () => {
    const { db } = createMockD1((sql) => {
      if (sql.includes("COUNT")) {
        return { first: async () => ({ n: 0 }) };
      }
      return undefined;
    });

    const model = new FlaxStageModel({ db, table: "flax_stages" });
    const result = await model.hasOpenStage("conv-1");
    expect(result).toBe(false);
  });

  test("findByConversationId generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxStageModel({ db, table: "flax_stages" });

    const results = await model.findByConversationId("conv-1");

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("SELECT * FROM flax_stages");
    expect(calls[0].sql).toContain("WHERE conversation_id = ?");
    expect(calls[0].sql).toContain("ORDER BY");
    expect(calls[0].params).toEqual(["conv-1"]);
    expect(results).toEqual([]);
  });

  test("ensureSchema creates table and index", async () => {
    const { db, calls } = createMockD1();

    await FlaxStageModel.ensureSchema(db);

    expect(calls.length).toBe(2);
    expect(calls[0].sql).toContain("CREATE TABLE IF NOT EXISTS flax_stages");
    expect(calls[1].sql).toContain("CREATE INDEX IF NOT EXISTS");
    expect(calls[1].sql).toContain("idx_flax_stages_conversation");
  });
});

describe("FlaxHitlModel", () => {
  test("insertHitl generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxHitlModel({ db, table: "flax_hitl" });

    await model.insertHitl({
      id: "hitl-abc",
      conversation_id: "conv-1",
      type: "approve-reject",
      title: "Approve deployment?",
      summary: "Deploy v2.0 to production",
      payload: { options: [{ label: "Yes", value: "yes" }] },
    });

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("INSERT INTO flax_hitl");
    expect(calls[0].sql).toContain("ON CONFLICT(id) DO NOTHING");
    expect(calls[0].params[0]).toBe("hitl-abc");
    expect(calls[0].params[1]).toBe("conv-1");
    expect(calls[0].params[2]).toBe("approve-reject");
    expect(calls[0].params[3]).toBe("Approve deployment?");
    expect(calls[0].params[4]).toBe("Deploy v2.0 to production");
    expect(JSON.parse(calls[0].params[5])).toEqual({
      options: [{ label: "Yes", value: "yes" }],
    });
    // 'pending' is a SQL literal, params[6] is the timestamp
    expect(typeof calls[0].params[6]).toBe("number");
  });

  test("insertHitl handles null summary and payload", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxHitlModel({ db, table: "flax_hitl" });

    await model.insertHitl({
      id: "hitl-abc",
      conversation_id: "conv-1",
      type: "alert",
      title: "Alert",
    });

    expect(calls[0].params[4]).toBeNull();
    expect(calls[0].params[5]).toBeNull();
  });

  test("pendingCount returns count of pending HITL items", async () => {
    const { db } = createMockD1((sql) => {
      if (sql.includes("COUNT")) {
        return { first: async () => ({ n: 3 }) };
      }
      return undefined;
    });

    const model = new FlaxHitlModel({ db, table: "flax_hitl" });
    const count = await model.pendingCount("conv-1");
    expect(count).toBe(3);
  });

  test("pendingCount returns 0 when no pending items", async () => {
    const { db } = createMockD1((sql) => {
      if (sql.includes("COUNT")) {
        return { first: async () => ({ n: 0 }) };
      }
      return undefined;
    });

    const model = new FlaxHitlModel({ db, table: "flax_hitl" });
    const count = await model.pendingCount("conv-1");
    expect(count).toBe(0);
  });

  test("resolveHitl generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxHitlModel({ db, table: "flax_hitl" });

    await model.resolveHitl("hitl-abc", "Approved");

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("UPDATE flax_hitl SET");
    expect(calls[0].sql).toContain("status = 'resolved'");
    expect(calls[0].sql).toContain("resolution = ?");
    expect(calls[0].sql).toContain("resolved_at = ?");
    expect(calls[0].sql).toContain("WHERE id = ?");
    expect(calls[0].params[0]).toBe("Approved");
    expect(typeof calls[0].params[1]).toBe("number");
    expect(calls[0].params[2]).toBe("hitl-abc");
  });

  test("findByConversationId generates correct SQL", async () => {
    const { db, calls } = createMockD1();
    const model = new FlaxHitlModel({ db, table: "flax_hitl" });

    const results = await model.findByConversationId("conv-1");

    expect(calls.length).toBe(1);
    expect(calls[0].sql).toContain("SELECT * FROM flax_hitl");
    expect(calls[0].sql).toContain("WHERE conversation_id = ?");
    expect(calls[0].sql).toContain("ORDER BY");
    expect(calls[0].params).toEqual(["conv-1"]);
    expect(results).toEqual([]);
  });

  test("ensureSchema creates table and index", async () => {
    const { db, calls } = createMockD1();

    await FlaxHitlModel.ensureSchema(db);

    expect(calls.length).toBe(2);
    expect(calls[0].sql).toContain("CREATE TABLE IF NOT EXISTS flax_hitl");
    expect(calls[1].sql).toContain("CREATE INDEX IF NOT EXISTS");
    expect(calls[1].sql).toContain("idx_flax_hitl_conversation");
  });
});

describe("BaseModel integration", () => {
  test("FlaxInstanceModel has correct tableName and columnTypes", () => {
    expect(FlaxInstanceModel.tableName).toBe("flax_instances");
    expect(FlaxInstanceModel.columnTypes).toBeDefined();
    expect(FlaxInstanceModel.columnTypes.id).toBe("text");
    expect(FlaxInstanceModel.columnTypes.title).toBe("text");
    expect(FlaxInstanceModel.columnTypes.status).toBe("text");
  });

  test("FlaxStageModel has correct tableName and columnTypes", () => {
    expect(FlaxStageModel.tableName).toBe("flax_stages");
    expect(FlaxStageModel.columnTypes).toBeDefined();
    expect(FlaxStageModel.columnTypes.conversation_id).toBe("text");
    expect(FlaxStageModel.columnTypes.stage).toBe("text");
  });

  test("FlaxHitlModel has correct tableName and columnTypes", () => {
    expect(FlaxHitlModel.tableName).toBe("flax_hitl");
    expect(FlaxHitlModel.columnTypes).toBeDefined();
    expect(FlaxHitlModel.columnTypes.id).toBe("text");
    expect(FlaxHitlModel.columnTypes.status).toBe("text");
  });
});
