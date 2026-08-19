import { Badge, Button, InputGroup, Loader } from "@cloudflare/kumo";
import { CheckCircle, GithubLogo, LinkSimple, Sparkle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { completeGithubInstall, configureGithubApp, githubStatus } from "./api";
import type { GithubStatus } from "./types";

const MANIFEST_FLOW_URL = "https://github.com/settings/apps/new?url=";

export function Setup({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const [appId, setAppId] = useState("");
  const [slug, setSlug] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [installationId, setInstallationId] = useState("");

  const refresh = () => {
    githubStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!status) {
    return (
      <div className="cf-empty" style={{ flex: 1 }}>
        <Loader size="lg" aria-label="loading setup status" />
      </div>
    );
  }

  const manifestUrl = `${MANIFEST_FLOW_URL}${encodeURIComponent(`${window.location.origin}/api/github/app-manifest`)}`;

  const saveManual = async () => {
    setError(null);
    try {
      const next = await configureGithubApp({ appId, slug, clientId, clientSecret, privateKey });
      setStatus(next);
      if (next.installation) onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const completeInstall = async () => {
    setError(null);
    try {
      const next = await completeGithubInstall(installationId.trim());
      setStatus(next);
      if (next.configured) onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const stepOk = (done: boolean) => (
    <span className="step-check" data-ok={done ? "true" : "false"}>
      {done ? (
        <CheckCircle size={15} weight="duotone" />
      ) : (
        <span className="num">{!status.configured ? 1 : 2}</span>
      )}
    </span>
  );

  return (
    <div className="cf-content setup">
      <div className="setup-hero">
        <GithubLogo size={34} weight="duotone" />
        <div>
          <h2 className="inbox-title">Connect GitHub</h2>
          <p className="inbox-sub">
            Flax agents open PRs and merge approved work on your repos. Connect a GitHub App so they
            can act on your behalf.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {status.configured ? (
          <Badge variant="success">connected</Badge>
        ) : (
          <Badge variant="warning">setup required</Badge>
        )}
      </div>

      {error ? (
        <div className="cf-error">
          <span style={{ fontWeight: 600 }}>Error</span>
          <span style={{ opacity: 0.85 }}>{error}</span>
        </div>
      ) : null}

      <div className="cf-card setup-card">
        <div className="step">
          {stepOk(status.configured)}
          <div className="body">
            <div className="title">Create the Flax GitHub App</div>
            <p>
              Opens GitHub's App Manifest flow. The dashboard exchanges the one-time code and stores
              the App credentials securely in D1.
            </p>
            {status.app ? (
              <div className="done">
                <Badge variant="success">App created</Badge>
                <span className="mono">
                  {status.app.slug} · {status.app.appId}
                </span>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={() => window.open(manifestUrl, "_blank", "noopener")}
              >
                <Sparkle size={14} /> Create GitHub App
              </Button>
            )}
          </div>
        </div>

        <div className="step">
          {stepOk(status.configured && status.installation !== null)}
          <div className="body">
            <div className="title">Install the App on your org</div>
            <p>
              Choose which repositories Flax may act on. After installing, GitHub redirects back and
              the dashboard verifies the connection.
            </p>
            {status.installation ? (
              <div className="done">
                <Badge variant="success">Installed</Badge>
                <span className="mono">
                  {status.installation.org} · {status.installation.installationId}
                </span>
              </div>
            ) : status.app ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (status.installUrl) window.location.href = status.installUrl;
                }}
              >
                <LinkSimple size={14} /> Install on org
              </Button>
            ) : null}
          </div>
        </div>

        <div className="step">
          {stepOk(status.configured && status.installation !== null && status.bindingLive)}
          <div className="body">
            <div className="title">Verify the pipeline is live</div>
            <p>
              A live check confirms Flax can mint installation tokens and reach the GitHub API on
              your repos.
            </p>
            {status.installation ? (
              <div className="done">
                <Badge variant={status.bindingLive ? "success" : "error"}>
                  {status.bindingLive ? "API live" : "API unreachable"}
                </Badge>
                <span className="mono">{status.app?.slug ?? ""}</span>
              </div>
            ) : null}
            {status.configured && status.installation && status.bindingLive ? (
              <Button variant="primary" onClick={onReady}>
                Continue to dashboard
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="cf-card setup-card">
        <div className="manual-toggle" onClick={() => setManual((m) => !m)}>
          <span>{manual ? "Hide" : "Show"} manual setup</span>
          <span className="cf-muted">Have an existing App? Configure credentials by hand.</span>
        </div>
        {manual ? (
          <div className="manual-form">
            <div className="fields">
              <label>
                App ID <input value={appId} onChange={(e) => setAppId(e.target.value)} />
              </label>
              <label>
                Slug <input value={slug} onChange={(e) => setSlug(e.target.value)} />
              </label>
              <label>
                Client ID <input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </label>
              <label>
                Client secret{" "}
                <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
              </label>
              <label className="wide">
                Private key (PEM)
                <textarea
                  rows={6}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                />
              </label>
            </div>
            <div className="actions">
              <Button
                variant="primary"
                disabled={!appId.trim() || !privateKey.trim()}
                onClick={() => void saveManual()}
              >
                Save App credentials
              </Button>
            </div>

            <div className="manual-install">
              <div className="title">Already installed? Link the installation id:</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <InputGroup>
                  <InputGroup.Input
                    placeholder="installation_id (from GitHub App settings)"
                    value={installationId}
                    onChange={(e) => setInstallationId(e.target.value)}
                  />
                  <InputGroup.Addon align="end">
                    <InputGroup.Button
                      variant="secondary"
                      disabled={!installationId.trim()}
                      onClick={() => void completeInstall()}
                    >
                      Verify
                    </InputGroup.Button>
                  </InputGroup.Addon>
                </InputGroup>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
