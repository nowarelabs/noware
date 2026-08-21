import { Badge, Button } from "@cloudflare/kumo";
import {
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Database,
  Globe,
  List,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { getSystemHealth, listCompanyBuilds, listSystems } from "./api";
import { navigate } from "./router";
import type { CompanyBuild, CompanySystem, SystemHealth } from "./types";

export function SystemDetailPage({ systemId }: { systemId: string }) {
  const [system, setSystem] = useState<CompanySystem | null>(null);
  const [health, setHealth] = useState<SystemHealth[]>([]);
  const [build, setBuild] = useState<CompanyBuild | null>(null);

  useEffect(() => {
    listSystems().then((systems) => {
      const found = systems.find((s) => s.systemId === systemId);
      if (found) {
        setSystem(found);
        listCompanyBuilds().then((builds) => {
          const b = builds.find((b) => b.systems.some((s) => s.systemId === systemId));
          if (b) setBuild(b);
        });
      }
    });
    getSystemHealth(systemId)
      .then(setHealth)
      .catch(() => {});
  }, [systemId]);

  const statusColor = (status: string) => {
    if (status === "deployed" || status === "healthy") return "success";
    if (status === "failed" || status === "degraded") return "error";
    return "info";
  };

  const latestHealth = health[health.length - 1];

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
        <Button onClick={() => navigate("/company-builder")} style={{ padding: "0.3rem 0.5rem" }}>
          <ArrowLeft size={14} />
        </Button>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
          {system?.name ?? systemId}
        </h2>
        {system && <Badge variant={statusColor(system.status)}>{system.status}</Badge>}
      </div>

      {system && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          <InfoCard icon={<Globe size={16} />} label="Worker URL" value={system.workerUrl || "—"} />
          <InfoCard
            icon={<Database size={16} />}
            label="Database"
            value={system.databaseId || "—"}
          />
          <InfoCard
            icon={latestHealth?.healthy ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
            label="Health"
            value={
              latestHealth ? `${latestHealth.status} (${latestHealth.responseTime}ms)` : "No data"
            }
          />
        </div>
      )}

      {health.length > 0 && (
        <div>
          <h3
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-color-kumo-subtle)",
            }}
          >
            Health History
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {health
              .slice(-10)
              .reverse()
              .map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--color-kumo-hairline)",
                    fontSize: "0.78rem",
                  }}
                >
                  {h.healthy ? (
                    <CheckCircle
                      size={12}
                      weight="fill"
                      style={{ color: "var(--color-kumo-green-900)" }}
                    />
                  ) : (
                    <WarningCircle
                      size={12}
                      weight="fill"
                      style={{ color: "var(--color-kumo-red-900)" }}
                    />
                  )}
                  <span className="mono">{h.endpoint}</span>
                  <span style={{ flex: 1 }} />
                  <Badge variant={h.healthy ? "success" : "error"}>{h.status}</Badge>
                  <span
                    className="mono"
                    style={{ fontSize: "0.7rem", color: "var(--text-color-kumo-inactive)" }}
                  >
                    {h.responseTime}ms
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {build && (
        <div>
          <h3
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-color-kumo-subtle)",
            }}
          >
            Other Systems in {build.name}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {build.systems
              .filter((s) => s.systemId !== systemId)
              .map((sys) => (
                <div
                  key={sys.systemId}
                  onClick={() => navigate(`/systems/${encodeURIComponent(sys.systemId)}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--color-kumo-hairline)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  <List size={12} weight="duotone" />
                  <span>{sys.name}</span>
                  <Badge variant={statusColor(sys.status)}>{sys.status}</Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        borderRadius: 8,
        border: "1px solid var(--color-kumo-hairline)",
        background: "var(--color-kumo-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
        <span style={{ color: "var(--text-color-kumo-subtle)" }}>{icon}</span>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--text-color-kumo-subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      </div>
      <div className="mono" style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
        {value}
      </div>
    </div>
  );
}
