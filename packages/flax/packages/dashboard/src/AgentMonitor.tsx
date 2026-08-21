import { Badge } from "@cloudflare/kumo";
import { Robot, Pulse, Brain, Eye } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { listStigmergicAgents } from "./api";
import type { StigmergicAgentStatus } from "./types";

export function AgentMonitorPage() {
  const [agents, setAgents] = useState<StigmergicAgentStatus[]>([]);

  useEffect(() => {
    listStigmergicAgents()
      .then(setAgents)
      .catch(() => {});
    const interval = setInterval(() => {
      listStigmergicAgents()
        .then(setAgents)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (status: string) => {
    if (status === "working") return "warning";
    if (status === "reading" || status === "leaving-cue") return "info";
    if (status === "waiting") return "secondary";
    return "success";
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "working":
        return <Pulse size={14} weight="duotone" />;
      case "reading":
        return <Eye size={14} weight="duotone" />;
      case "leaving-cue":
        return <Brain size={14} weight="duotone" />;
      default:
        return <Robot size={14} weight="duotone" />;
    }
  };

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Robot size={22} weight="duotone" />
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Stigmergic Agents</h2>
        <Badge variant="info">{agents.length} agents</Badge>
      </div>

      {agents.length === 0 && (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--text-color-kumo-inactive)",
            fontSize: "0.8rem",
          }}
        >
          No agents running. Start a company build to see agents in action.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {agents.map((agent) => (
          <div
            key={agent.id}
            style={{
              padding: "1rem",
              borderRadius: 8,
              border: "1px solid var(--color-kumo-hairline)",
              background: "var(--color-kumo-surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              {statusIcon(agent.status)}
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{agent.agentType}</span>
              <Badge variant={statusColor(agent.status)}>{agent.status}</Badge>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
                fontSize: "0.75rem",
                color: "var(--text-color-kumo-subtle)",
              }}
            >
              <div>
                <span className="mono">ID:</span> {agent.id.slice(0, 16)}...
              </div>
              <div>
                <span className="mono">Atom:</span> {agent.atomDoId.slice(0, 16)}...
              </div>
              <div>
                <span className="mono">Actions:</span> {agent.actionCount}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
