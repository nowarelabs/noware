import { describe, expect, test } from "vite-plus/test";
import { Provisioner } from "../src/provisioner";
import { Deployer } from "../src/deployer";
import { ConfigGenerator } from "../src/config-generator";
import { SystemBuilder } from "../src/system-builder";

describe("Provisioner", () => {
  test("provisions database", async () => {
    const p = new Provisioner();
    const result = await p.provisionDatabase({ name: "test-db", tables: [], migrations: [] });
    expect(result.type).toBe("D1");
    expect(result.status).toBe("provisioned");
  });

  test("provisions worker", async () => {
    const p = new Provisioner();
    const result = await p.provisionWorker({
      id: "w1",
      name: "Test Worker",
      type: "worker",
      cfourElementId: "e1",
      parentContainerId: "c1",
      config: {},
      bindings: [],
      integrations: [],
    });
    expect(result.type).toBe("Worker");
    expect(result.endpoint).toContain("test-worker");
  });

  test("deprovisions", async () => {
    const p = new Provisioner();
    const result = await p.provisionKV({ name: "cache" });
    await p.deprovision(result.id);
    expect(p.getProvisioned(result.id)).toBeUndefined();
  });
});

describe("Deployer", () => {
  test("deploys worker", async () => {
    const d = new Deployer();
    const result = await d.deploy("my-worker", "code", []);
    expect(result.status).toBe("deployed");
    expect(result.url).toContain("my-worker");
  });

  test("rollback", async () => {
    const d = new Deployer();
    await d.deploy("my-worker", "code", []);
    await d.rollback("my-worker", "v1");
    const status = await d.getDeploymentStatus("my-worker");
    expect(status?.status).toBe("rolled-back");
  });
});

describe("ConfigGenerator", () => {
  test("generates wrangler config", () => {
    const g = new ConfigGenerator();
    const config = g.generate({
      id: "s1",
      name: "Payment API",
      type: "worker",
      cfourElementId: "e1",
      parentContainerId: "c1",
      config: {},
      bindings: [{ name: "DB", type: "D1", resource: "db-123" }],
      integrations: [],
    });
    expect(config).toContain("payment-api");
    expect(config).toContain("D1");
  });

  test("generates SQL migration", () => {
    const g = new ConfigGenerator();
    const sql = g.generateDatabaseMigration([
      {
        name: "users",
        columns: [
          { name: "id", type: "INTEGER", primaryKey: true },
          { name: "email", type: "TEXT", nullable: false },
          { name: "name", type: "TEXT" },
        ],
        indexes: [{ name: "idx_email", columns: ["email"], unique: true }],
      },
    ]);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(sql).toContain("id INTEGER PRIMARY KEY NOT NULL");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_email");
  });
});

describe("SystemBuilder", () => {
  test("builds complete system", async () => {
    const sb = new SystemBuilder();
    const result = await sb.build(
      {
        id: "s1",
        name: "Payment API",
        type: "worker",
        cfourElementId: "e1",
        parentContainerId: "c1",
        config: {},
        database: {
          name: "payments",
          tables: [
            {
              name: "transactions",
              columns: [{ name: "id", type: "INTEGER", primaryKey: true }],
              indexes: [],
            },
          ],
          migrations: [],
        },
        bindings: [{ name: "DB", type: "D1", resource: "db-123" }],
        integrations: [],
      },
      "export default { fetch() { return new Response('ok'); } }",
    );
    expect(result.status).toBe("deployed");
    expect(result.workerUrl).toContain("payment-api");
    expect(result.databaseId).toContain("db-");
  });
});
