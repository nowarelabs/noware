import type {
  AgentRow,
  Conversation,
  ConversationDetail,
  ConversationSummary,
  GithubStatus,
  HitlRow,
  ResolveResult,
  ScanResult,
  StageRow,
  ArtifactRow,
  StreamControl,
  StreamItem,
} from "./types";

export const AGENT_BASE: string =
  (import.meta.env.VITE_AGENT_BASE as string | undefined) ?? "/agents/orchestrator";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return body.slice(0, 500);
  } catch {
    return res.statusText;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------- conversations

export async function listConversations(): Promise<ConversationSummary[]> {
  const body = await request<{ conversations: ConversationSummary[] }>("/api/conversations");
  return body.conversations ?? [];
}

export async function createConversation(
  message: string,
  opts?: { title?: string; origin?: string },
): Promise<{ id: string; title: string; origin: string; admission: unknown }> {
  return postJson("/api/conversations", { message, ...opts });
}

export async function fetchConversationDetail(id: string): Promise<ConversationDetail> {
  const body = await request<{ conversation: ConversationDetail }>(
    `/api/conversations/${encodeURIComponent(id)}`,
  );
  return body.conversation;
}

export async function scanConversation(id: string): Promise<ScanResult> {
  return postJson(`/api/conversations/${encodeURIComponent(id)}/scan`, {});
}

export async function listStages(id: string): Promise<StageRow[]> {
  const body = await request<{ stages: StageRow[] }>(
    `/api/conversations/${encodeURIComponent(id)}/stages`,
  );
  return body.stages ?? [];
}

export async function listArtifacts(id: string): Promise<ArtifactRow[]> {
  const body = await request<{ artifacts: ArtifactRow[] }>(
    `/api/conversations/${encodeURIComponent(id)}/artifacts`,
  );
  return body.artifacts ?? [];
}

// ---------------------------------------------------------------- HITL

export async function listHitl(id: string): Promise<HitlRow[]> {
  const body = await request<{ hitl: HitlRow[] }>(
    `/api/conversations/${encodeURIComponent(id)}/hitl`,
  );
  return body.hitl ?? [];
}

export async function resolveHitl(
  hitlId: string,
  resolution: Record<string, unknown>,
  note?: string,
): Promise<ResolveResult> {
  return postJson(`/api/hitl/${encodeURIComponent(hitlId)}/resolve`, { resolution, note });
}

// ---------------------------------------------------------------- roster + GitHub

export async function listAgents(): Promise<AgentRow[]> {
  const body = await request<{ agents: AgentRow[] }>("/api/agents");
  return body.agents ?? [];
}

export async function githubStatus(): Promise<GithubStatus> {
  return request<GithubStatus>("/api/github/status");
}

export async function configureGithubApp(input: {
  appId: string;
  slug?: string;
  clientId?: string;
  clientSecret?: string;
  privateKey: string;
}): Promise<GithubStatus> {
  return postJson("/api/github/app/configure", input);
}

export async function completeGithubInstall(installationId: string): Promise<GithubStatus> {
  return postJson("/api/github/install/complete", { installationId });
}

// ---------------------------------------------------------------- Flue agent client (chat)

export async function fetchConversation(id: string, signal?: AbortSignal): Promise<Conversation> {
  const res = await fetch(`${AGENT_BASE}/${encodeURIComponent(id)}`, { signal });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as Conversation;
}

export interface Admission {
  streamUrl: string;
  offset: string;
  submissionId: string;
  uid: string;
}

export async function submitMessage(id: string, body: string): Promise<Admission> {
  const res = await fetch(`${AGENT_BASE}/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "user", body }),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as Admission;
}

export function agentJsonUrl(id: string): string {
  return `${AGENT_BASE}/${encodeURIComponent(id)}`;
}

export interface AgentInstanceInfo {
  id: string;
  created_at: number;
  last_seen_at: number;
}

export async function listInstances(): Promise<AgentInstanceInfo[]> {
  const res = await fetch(AGENT_BASE);
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  const body = (await res.json()) as { instances?: AgentInstanceInfo[] };
  return body.instances ?? [];
}

export async function streamUpdates(
  id: string,
  offset: string,
  signal: AbortSignal,
  onItems: (items: StreamItem[]) => void,
  onControl: (control: StreamControl) => void,
): Promise<void> {
  if (signal.aborted) return;

  const url = `${AGENT_BASE}/${encodeURIComponent(id)}?view=updates&offset=${encodeURIComponent(offset)}&live=sse`;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });

  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  if (!signal.aborted) {
    connectTimer = setTimeout(() => controller.abort(new Error("Connection timeout")), 15_000);
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = undefined;

    if (!res.ok) throw new ApiError(res.status, await readError(res));
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const onAbortCancelReader = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", onAbortCancelReader, { once: true });

    const handleFrame = (frame: string) => {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:"))
          data += `${data ? "\n" : ""}${line.slice(5).replace(/^ /, "")}`;
      }
      if (!data) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }
      if (event === "data" && Array.isArray(parsed)) onItems(parsed as StreamItem[]);
      else if (event === "control") onControl(parsed as StreamControl);
    };

    try {
      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (frame.trim()) handleFrame(frame);
        }
      }
      if (buffer.trim()) handleFrame(buffer);
    } finally {
      signal.removeEventListener("abort", onAbortCancelReader);
      void reader.cancel().catch(() => {});
    }
  } finally {
    if (connectTimer) clearTimeout(connectTimer);
    signal.removeEventListener("abort", onParentAbort);
  }
}
