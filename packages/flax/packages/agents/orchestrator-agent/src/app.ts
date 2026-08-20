import { HttpEntrypoint } from "@nowarelabs/entrypoints";
import { createAgentRouter, type AgentRoute } from "@nowarelabs/agents";

import agentDef from "./agents/orchestrator";
import { OrchestratorController } from "./controllers/orchestrator.controller.js";

const AGENT_PATH = "/agents/orchestrator";

const routes: AgentRoute[] = [
  {
    method: "GET",
    pattern: AGENT_PATH,
    handler: async (request, env) => {
      const controller = new OrchestratorController(
        request as any,
        env as any,
        { params: {} } as any,
      );
      return controller.run("listInstances");
    },
  },
  {
    method: "GET",
    pattern: "/api/ping",
    handler: async (request, env) => {
      const controller = new OrchestratorController(
        request as any,
        env as any,
        { params: {} } as any,
      );
      return controller.run("ping");
    },
  },
];

export default class AgentEntrypoint extends HttpEntrypoint {
  router = createAgentRouter(agentDef, { routes });
}
