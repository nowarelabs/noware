import type { D1Database } from "@cloudflare/workers-types";

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
  return crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Sign a GitHub App JWT (RS256) with the app's private key. */
async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
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

async function githubFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers as Record<string, string>),
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

async function getAppRow(db: D1Database): Promise<{ app_id: string; private_key: string } | null> {
  const row = await db
    .prepare("SELECT app_id, private_key FROM flax_github_app WHERE id = 1")
    .first<{ app_id: string; private_key: string }>();
  return row ?? null;
}

async function getInstallRow(db: D1Database): Promise<{ installation_id: string } | null> {
  const row = await db
    .prepare("SELECT installation_id FROM flax_github_install ORDER BY installed_at DESC LIMIT 1")
    .first<{ installation_id: string }>();
  return row ?? null;
}

async function cachedToken(db: D1Database, installationId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT token, expires_at FROM flax_github_token WHERE installation_id = ?")
    .bind(installationId)
    .first<{ token: string; expires_at: number }>();
  if (row && row.expires_at - Date.now() > 5 * 60 * 1000) return row.token;
  return null;
}

async function mintInstallationToken(db: D1Database, installationId: string): Promise<string> {
  const app = await getAppRow(db);
  if (!app) throw new Error("GitHub App is not configured — run the dashboard setup flow first.");
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
    .bind(installationId, data.token, expiresAt, Date.now())
    .run();
  return data.token;
}

async function installationIdForRepo(db: D1Database, repo?: string): Promise<string> {
  if (repo) {
    const app = await getAppRow(db);
    if (app) {
      try {
        const jwt = await signAppJwt(app.app_id, app.private_key);
        const data = (await githubFetch(`/repos/${repo}/installation`, {
          headers: { Authorization: `Bearer ${jwt}` },
        })) as { id?: number };
        if (data.id) return String(data.id);
      } catch {
        // fall through to the stored installation
      }
    }
  }
  const install = await getInstallRow(db);
  if (!install) throw new Error("No GitHub installation configured");
  return install.installation_id;
}

/**
 * Authorization header for GitHub API calls: personal access token when
 * GITHUB_TOKEN is configured, otherwise an App installation token minted from
 * the dashboard's stored App credentials (cached in D1 until near expiry).
 */
export async function authForRepo(
  env: { FLAX_DB?: D1Database; [key: string]: unknown },
  repo?: string,
): Promise<string> {
  const pat = env.GITHUB_TOKEN;
  if (typeof pat === "string" && pat.length > 0) {
    return `Bearer ${pat}`;
  }
  const db = env.FLAX_DB;
  if (!db)
    throw new Error(
      "No GitHub credential available: set GITHUB_TOKEN or bind FLAX_DB with a configured App.",
    );
  const installationId = await installationIdForRepo(db, repo);
  const cached = await cachedToken(db, installationId);
  if (cached) return `Bearer ${cached}`;
  const token = await mintInstallationToken(db, installationId);
  return `Bearer ${token}`;
}

/** Extract `owner/repo` from an API path like `/repos/owner/repo/pulls`. */
export function repoFromPath(path: string): string | undefined {
  return path.match(/^\/repos\/([^/]+\/[^/]+)/)?.[1];
}
