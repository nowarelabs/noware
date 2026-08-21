import { Badge, Loader, Switch } from "@cloudflare/kumo";
import { GithubLogo, BuildingOffice, Robot } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { githubStatus } from "./api";
import { AgentMonitorPage } from "./AgentMonitor";
import { CompanyBuilderPage } from "./CompanyBuilder";
import { Conversation } from "./Conversation";
import { Inbox } from "./Inbox";
import { navigate, useRoute } from "./router";
import { Setup } from "./Setup";
import { SystemDetailPage } from "./SystemDetail";
import type { GithubStatus } from "./types";

const THEME_KEY = "flax.dashboard.dark";

export function App() {
  const route = useRoute();
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", dark ? "dark" : "light");
    try {
      localStorage.setItem(THEME_KEY, dark ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const loadGithub = useCallback(() => {
    githubStatus()
      .then((s) => {
        setGithub(s);
        setGithubError(null);
      })
      .catch((err) => setGithubError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    loadGithub();
  }, [loadGithub]);

  const needsSetup = github !== null && !github.configured;
  // Route: company builder, system detail, agent monitor, setup, conversation, inbox
  let screen: React.ReactNode;
  if (route.path === "/company-builder") {
    screen = <CompanyBuilderPage />;
  } else if (route.path.startsWith("/systems/") && route.params.id) {
    screen = <SystemDetailPage systemId={route.params.id} />;
  } else if (route.path === "/agents") {
    screen = <AgentMonitorPage />;
  } else if (route.path === "/setup") {
    screen = (
      <Setup
        onReady={() => {
          loadGithub();
          navigate("/");
        }}
      />
    );
  } else if (route.path.startsWith("/conversations/") && route.params.id) {
    screen = <Conversation id={route.params.id} onBack={() => navigate("/")} />;
  } else if (needsSetup) {
    screen = (
      <Setup
        onReady={() => {
          loadGithub();
          navigate("/");
        }}
      />
    );
  } else if (githubError) {
    screen = (
      <Setup
        onReady={() => {
          loadGithub();
          navigate("/");
        }}
      />
    );
  } else {
    screen = <Inbox onNavigate={(id) => navigate(`/conversations/${id}`)} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header className="cf-topbar">
        <img
          src="/logo-icon.png"
          alt="Nowarelabs"
          style={{ height: 30, width: "auto", flex: "none" }}
        />
        <span className="divider" />
        <div className="product">
          <span className="name">Flax</span>
          <span className="tagline">Nowarelabs · Human interface dashboard</span>
        </div>
        <div className="right">
          <div
            className="nav-links"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <button
              onClick={() => navigate("/company-builder")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.3rem 0.6rem",
                borderRadius: 6,
                border:
                  route.path === "/company-builder"
                    ? "1px solid var(--color-kumo-blue-700)"
                    : "1px solid var(--color-kumo-hairline)",
                background:
                  route.path === "/company-builder" ? "var(--color-kumo-blue-50)" : "transparent",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: "var(--text-color-kumo-primary)",
              }}
            >
              <BuildingOffice size={13} weight="duotone" />
              Builder
            </button>
            <button
              onClick={() => navigate("/agents")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.3rem 0.6rem",
                borderRadius: 6,
                border:
                  route.path === "/agents"
                    ? "1px solid var(--color-kumo-blue-700)"
                    : "1px solid var(--color-kumo-hairline)",
                background: route.path === "/agents" ? "var(--color-kumo-blue-50)" : "transparent",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: "var(--text-color-kumo-primary)",
              }}
            >
              <Robot size={13} weight="duotone" />
              Agents
            </button>
          </div>
          {github === null ? (
            <Loader size={13} aria-label="loading" />
          ) : (
            <button
              className="github-link"
              onClick={() => navigate("/setup")}
              title={
                github.configured
                  ? `Connected: ${github.installation?.org ?? ""}`
                  : "Connect GitHub"
              }
            >
              <GithubLogo size={14} />
              {github.configured ? (
                <Badge variant="success">{github.installation?.org ?? "connected"}</Badge>
              ) : (
                <Badge variant="warning">connect</Badge>
              )}
            </button>
          )}
          <Switch checked={dark} onCheckedChange={setDark} label="Dark" controlFirst={false} />
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--color-kumo-canvas)",
          }}
        >
          {screen}
        </main>
      </div>

      <div className="cf-footer">
        <img src="/logo.png" alt="Nowarelabs" style={{ height: 10, width: "auto", flex: "none" }} />
        <span>Flax Dashboard</span>
        <span className="mono" style={{ fontSize: "0.7rem" }}>
          orchestrator · 15 agents · Cloudflare Workers
        </span>
        <div className="right">
          {github?.configured ? (
            <span className="mono" style={{ fontSize: "0.7rem" }}>
              {github.app?.slug ?? "github app"}
            </span>
          ) : null}
          <span className="mono" style={{ fontSize: "0.7rem" }}>
            @cloudflare/meta llama-4-scout · D1
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
