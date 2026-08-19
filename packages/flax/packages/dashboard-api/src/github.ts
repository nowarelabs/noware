import type { D1Database } from "@cloudflare/workers-types";

import type { GithubAppRow, GithubInstallRow } from "./schema";

const GITHUB_API = "https://api.github.com";

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  return base64urlDecode(body).buffer as ArrayBuffer;
}

async function importPemPrivateKey(pem: string): Promise<CryptoKey> {
  const bytes = pemToBytes(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Sign a GitHub App JWT (RS256) with the app's private key. */
export async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })),
  );
  const key = await importPemPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

/** The manifest this dashboard can install as a GitHub App (create from a button on the setup screen). */
export function appManifest(baseUrl: string): Record<string, unknown> {
  return {
    name: "Flax Build Agents",
    description:
      "Flax multi-agent SDLC runner. Opens pull requests, comments on issues, and merges approved PRs on your behalf.",
    url: baseUrl,
    hook_url: `${baseUrl}/api/github/webhook`,
    redirect_url: `${baseUrl}/api/github/app-manifest-callback`,
    callback_url: `${baseUrl}/api/github/install/callback`,
    setup_url: `${baseUrl}/api/github/install/callback`,
    public: true,
    default_permissions: {
      contents: "write",
      issues: "write",
      pull_requests: "write",
      metadata: "read",
      checks: "read",
      statuses: "read",
    },
    default_events: ["push", "pull_request", "issue_comment", "check_run"],
    request_oauth_on_install: false,
  };
}

async function githubFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      "User-Agent": "flax-dashboard",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Exchange a manifest code (from the App Manifest flow) for app credentials. */
export async function convertManifestCode(code: string): Promise<{
  id: number;
  slug: string;
  client_id: string;
  client_secret: string;
  pem: string;
  webhook_secret: string;
}> {
  const data = (await githubFetch(`/app-manifests/${encodeURIComponent(code)}/conversions`, {
    method: "POST",
  })) as {
    id: number;
    slug: string;
    client_id: string;
    client_secret: string;
    pem: string;
    webhook_secret: string;
  };
  return data;
}

async function getAppRow(db: D1Database): Promise<GithubAppRow | null> {
  const row = await db.prepare("SELECT * FROM flax_github_app WHERE id = 1").first<GithubAppRow>();
  return row ?? null;
}

export async function saveAppRow(
  db: D1Database,
  app: {
    app_id: string;
    slug: string;
    client_id: string;
    client_secret: string;
    private_key: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO flax_github_app (id, app_id, slug, client_id, client_secret, private_key, created_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         app_id = excluded.app_id,
         slug = excluded.slug,
         client_id = excluded.client_id,
         client_secret = excluded.client_secret,
         private_key = excluded.private_key`,
    )
    .bind(app.app_id, app.slug, app.client_id, app.client_secret, app.private_key, Date.now())
    .run();
}

async function getInstallRow(db: D1Database): Promise<GithubInstallRow | null> {
  const row = await db
    .prepare("SELECT * FROM flax_github_install ORDER BY installed_at DESC LIMIT 1")
    .first<GithubInstallRow>();
  return row ?? null;
}

export async function saveInstallRow(
  db: D1Database,
  install: { installation_id: string; org: string; account_type: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO flax_github_install (installation_id, org, account_type, installed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(installation_id) DO UPDATE SET
         org = excluded.org,
         account_type = excluded.account_type,
         installed_at = excluded.installed_at`,
    )
    .bind(install.installation_id, install.org, install.account_type, Date.now())
    .run();
}

/** Resolve which GitHub account this installation belongs to (validates the token path is live). */
export async function resolveInstallation(
  db: D1Database,
  installationId: string,
): Promise<{ org: string; account_type: string }> {
  const app = await getAppRow(db);
  if (!app) throw new Error("GitHub App is not configured — run the setup flow first.");
  const jwt = await signAppJwt(app.app_id, app.private_key);
  const data = (await githubFetch(`/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })) as { account?: { login?: string; type?: string } };
  const org = data.account?.login;
  if (!org) throw new Error(`Installation ${installationId} has no account`);
  return { org, account_type: data.account?.type ?? "User" };
}

export interface InstallStatus {
  configured: boolean;
  app: { slug: string; appId: string; clientId: string } | null;
  installation: { installationId: string; org: string; accountType: string } | null;
  bindingLive: boolean;
}

export async function getInstallStatus(db: D1Database): Promise<InstallStatus> {
  const app = await getAppRow(db);
  const install = await getInstallRow(db);
  if (!app || !install) {
    return {
      configured: Boolean(app && install),
      app: app ? { slug: app.slug, appId: app.app_id, clientId: app.client_id } : null,
      installation: null,
      bindingLive: false,
    };
  }
  const token = await installationToken(db, install.installation_id);
  let bindingLive = false;
  if (token) {
    try {
      const res = await fetch(`${GITHUB_API}/installation/repositories`, {
        headers: {
          "User-Agent": "flax-dashboard",
          Authorization: `Bearer ${token.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      bindingLive = res.ok;
    } catch {
      bindingLive = false;
    }
  }
  return {
    configured: true,
    app: { slug: app.slug, appId: app.app_id, clientId: app.client_id },
    installation: {
      installationId: install.installation_id,
      org: install.org,
      accountType: install.account_type,
    },
    bindingLive,
  };
}

export interface InstallationToken {
  token: string;
  expires_at: number;
}

/** Get a fresh installation access token, caching it in D1 until it nears expiry. */
export async function installationToken(
  db: D1Database,
  installationId: string,
): Promise<InstallationToken | null> {
  const app = await getAppRow(db);
  if (!app) return null;
  if (!/^\d+$/.test(installationId)) return null;

  const cached = await db
    .prepare("SELECT * FROM flax_github_token WHERE installation_id = ?")
    .bind(installationId)
    .first<{ token: string; expires_at: number }>();
  const now = Date.now();
  if (cached && cached.expires_at - now > 5 * 60 * 1000) {
    return { token: cached.token, expires_at: cached.expires_at };
  }

  const jwt = await signAppJwt(app.app_id, app.private_key);
  const data = (await githubFetch(`/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
  })) as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();
  await db
    .prepare(
      `INSERT INTO flax_github_token (installation_id, token, expires_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(installation_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    )
    .bind(installationId, data.token, expiresAt, now)
    .run();
  return { token: data.token, expires_at: expiresAt };
}

/** Authenticated GitHub fetch for the installed org, used by the dashboard API. */
export async function ghFetch(
  db: D1Database,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const install = await getInstallRow(db);
  if (!install) throw new Error("No GitHub installation configured");
  const token = await installationToken(db, install.installation_id);
  if (!token) throw new Error("Unable to mint a GitHub installation token");
  return githubFetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.token}`,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
}
