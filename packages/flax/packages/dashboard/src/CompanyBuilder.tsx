import { Badge, Button, Input } from "@cloudflare/kumo";
import {
  BuildingOffice,
  TreeView,
  CaretRight,
  CheckCircle,
  WarningCircle,
  Spinner,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { buildCompany, getCompanyHierarchy, listCompanyBuilds } from "./api";
import { navigate } from "./router";
import type { CompanyBuild, OrchestratorNode } from "./types";

export function CompanyBuilderPage() {
  const [description, setDescription] = useState("");
  const [building, setBuilding] = useState(false);
  const [builds, setBuilds] = useState<CompanyBuild[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<CompanyBuild | null>(null);
  const [hierarchy, setHierarchy] = useState<OrchestratorNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCompanyBuilds()
      .then(setBuilds)
      .catch(() => {});
  }, []);

  const handleBuild = useCallback(async () => {
    if (!description.trim()) return;
    setBuilding(true);
    setError(null);
    try {
      const result = await buildCompany(description);
      setSelectedBuild(result);
      setBuilds((prev) => [result, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }, [description]);

  const handleSelectBuild = useCallback(async (build: CompanyBuild) => {
    setSelectedBuild(build);
    try {
      const h = await getCompanyHierarchy(build.id);
      setHierarchy(h);
    } catch {
      setHierarchy(null);
    }
  }, []);

  const statusIcon = (status: string) => {
    switch (status) {
      case "deployed":
        return (
          <CheckCircle size={14} weight="fill" style={{ color: "var(--color-kumo-green-900)" }} />
        );
      case "building":
      case "deploying":
      case "parsing":
        return (
          <Spinner size={14} weight="duotone" style={{ color: "var(--color-kumo-blue-900)" }} />
        );
      case "failed":
        return (
          <WarningCircle size={14} weight="fill" style={{ color: "var(--color-kumo-red-900)" }} />
        );
      default:
        return null;
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
        <BuildingOffice size={22} weight="duotone" />
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Company Builder</h2>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your company... (e.g., 'Build a payment processing company with KYC, fraud detection, and notifications')"
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !building) handleBuild();
          }}
        />
        <Button onClick={handleBuild} disabled={building || !description.trim()}>
          {building ? "Building..." : "Build"}
        </Button>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: 6,
            background: "var(--color-kumo-red-50)",
            color: "var(--color-kumo-red-900)",
            fontSize: "0.8rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Builds list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflow: "auto" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-color-kumo-subtle)",
            }}
          >
            Builds
          </h3>
          {builds.length === 0 && (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-color-kumo-inactive)",
                fontSize: "0.8rem",
              }}
            >
              No builds yet. Describe a company above to get started.
            </div>
          )}
          {builds.map((build) => (
            <div
              key={build.id}
              onClick={() => handleSelectBuild(build)}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: 8,
                border:
                  selectedBuild?.id === build.id
                    ? "1px solid var(--color-kumo-blue-700)"
                    : "1px solid var(--color-kumo-hairline)",
                background: "var(--color-kumo-surface)",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {statusIcon(build.status)}
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{build.name}</span>
                <Badge
                  variant={
                    build.status === "deployed"
                      ? "success"
                      : build.status === "failed"
                        ? "error"
                        : "info"
                  }
                >
                  {build.status}
                </Badge>
                <span style={{ flex: 1 }} />
                <span
                  className="mono"
                  style={{ fontSize: "0.7rem", color: "var(--text-color-kumo-inactive)" }}
                >
                  {build.systems.length} systems
                </span>
              </div>
              <div
                style={{
                  marginTop: "0.3rem",
                  fontSize: "0.75rem",
                  color: "var(--text-color-kumo-subtle)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {build.description}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflow: "auto" }}>
          {selectedBuild ? (
            <>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-color-kumo-subtle)",
                }}
              >
                {selectedBuild.name}
              </h3>

              {/* Systems */}
              {selectedBuild.systems.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.78rem", fontWeight: 600 }}>
                    Systems
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {selectedBuild.systems.map((sys) => (
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
                          background: "var(--color-kumo-surface)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        {statusIcon(sys.status)}
                        <span style={{ fontWeight: 500 }}>{sys.name}</span>
                        <Badge
                          variant={
                            sys.status === "deployed" || sys.status === "healthy"
                              ? "success"
                              : sys.status === "failed"
                                ? "error"
                                : "info"
                          }
                        >
                          {sys.status}
                        </Badge>
                        <span style={{ flex: 1 }} />
                        <CaretRight size={12} style={{ opacity: 0.4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hierarchy */}
              {hierarchy && (
                <div>
                  <h4
                    style={{
                      margin: "0 0 0.4rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <TreeView size={14} weight="duotone" />
                    Orchestrator Hierarchy
                  </h4>
                  <HierarchyTreeView node={hierarchy} depth={0} />
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-color-kumo-inactive)",
                fontSize: "0.8rem",
              }}
            >
              Select a build to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HierarchyTreeView({ node, depth }: { node: OrchestratorNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const levelColors: Record<string, string> = {
    root: "var(--color-kumo-blue-700)",
    ss: "var(--color-kumo-purple-700)",
    container: "var(--color-kumo-green-700)",
    component: "var(--color-kumo-orange-700)",
  };

  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.5rem",
          paddingLeft: `${depth * 1.2 + 0.5}rem`,
          cursor: hasChildren ? "pointer" : "default",
          fontSize: "0.78rem",
          borderRadius: 4,
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => {
          if (hasChildren) e.currentTarget.style.background = "var(--color-kumo-canvas)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {hasChildren ? (
          <span style={{ fontSize: "0.6rem", opacity: 0.5, width: 8 }}>{expanded ? "▼" : "▶"}</span>
        ) : (
          <span style={{ width: 8 }} />
        )}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: levelColors[node.level] ?? "var(--color-kumo-gray-500)",
            flexShrink: 0,
          }}
        />
        <Badge
          variant={node.level === "root" ? "info" : node.level === "ss" ? "warning" : "secondary"}
        >
          {node.level}
        </Badge>
        <span style={{ fontWeight: node.level === "root" ? 600 : 400 }}>{node.name}</span>
        {node.description && (
          <span style={{ color: "var(--text-color-kumo-inactive)", fontSize: "0.72rem" }}>
            {node.description.slice(0, 60)}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <HierarchyTreeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
