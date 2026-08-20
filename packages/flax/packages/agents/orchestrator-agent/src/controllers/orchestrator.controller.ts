import { BaseController } from "@nowarelabs/controllers";
import type { D1Database } from "@cloudflare/workers-types";

import { ensureSchema } from "../dashboard-db.js";
import { OrchestratorService } from "../services/orchestrator.service.js";

interface FlaxEnv {
  FLAX_DB?: D1Database;
  [key: string]: unknown;
}

export class OrchestratorController extends BaseController {
  private svc: OrchestratorService | undefined;

  protected getService(): OrchestratorService {
    if (!this.svc) {
      const db = (this.env as unknown as FlaxEnv).FLAX_DB;
      this.svc = new OrchestratorService(db!);
    }
    return this.svc;
  }

  async listInstances(): Promise<Response> {
    const db = (this.env as unknown as FlaxEnv).FLAX_DB;
    if (!db) return this.json({ instances: [] });
    await ensureSchema(db);
    const svc = this.getService();
    const instances = await svc.listInstances();
    return this.json({ instances });
  }

  async ping(): Promise<Response> {
    return this.text("pong");
  }
}
