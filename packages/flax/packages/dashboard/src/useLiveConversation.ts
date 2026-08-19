import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { ApiError, fetchConversation, streamUpdates, submitMessage } from './api';
import type {
  Conversation,
  ConversationMessage,
  DataPartState,
  Part,
  Settlement,
  StreamControl,
  StreamItem,
} from './types';

export type StreamStatus = 'idle' | 'loading' | 'live' | 'new' | 'error';

export interface LogEntry {
  id: number;
  ts: string;
  kind: string;
  detail: string;
  outcome?: string;
}

export interface LiveMessage {
  messageId: string;
  submissionId?: string;
  turnId?: string;
  text: string;
}

interface State {
  messages: ConversationMessage[];
  settlements: Settlement[];
  dataParts: DataPartState[];
  conversationId?: string;
  incarnation?: string;
  live: LiveMessage | null;
}

type Action =
  | { type: 'reset' }
  | { type: 'snapshot'; payload: Conversation }
  | { type: 'append'; payload: ConversationMessage }
  | { type: 'data-part'; payload: { name: string; data: unknown } }
  | { type: 'live-start'; payload: { messageId: string; submissionId?: string; turnId?: string } }
  | { type: 'live-delta'; payload: { messageId: string; kind: string; delta: string } }
  | { type: 'live-complete'; payload: { messageId: string; timestamp: string } }
  | {
      type: 'settled';
      payload: { submissionId: string; outcome: string; answeredBySubmissionId?: string };
    };

const initialState: State = {
  messages: [],
  settlements: [],
  dataParts: [],
  live: null,
};

function collectDataParts(parts: Part[]): { name: string; data: unknown }[] {
  const out: { name: string; data: unknown }[] = [];
  for (const part of parts) {
    if (typeof part.type === 'string' && part.type.startsWith('data-')) {
      out.push({ name: part.type.slice(5), data: part.data });
    }
  }
  return out;
}

function upsertDataPart(list: DataPartState[], name: string, data: unknown): DataPartState[] {
  const entry: DataPartState = { name, data, updatedAt: new Date().toLocaleTimeString() };
  const idx = list.findIndex((d) => d.name === name);
  if (idx === -1) return [...list, entry];
  const next = [...list];
  next[idx] = entry;
  return next;
}

function dataPartsFromMessages(messages: ConversationMessage[]): DataPartState[] {
  let dataParts: DataPartState[] = [];
  for (const message of messages) {
    for (const { name, data } of collectDataParts(message.parts)) {
      dataParts = upsertDataPart(dataParts, name, data);
    }
  }
  return dataParts;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { ...initialState };
    case 'snapshot': {
      const merged = [...state.messages];
      for (const m of action.payload.messages) {
        const idx = merged.findIndex((x) => x.id === m.id);
        if (idx === -1) {
          merged.push(m);
        } else {
          merged[idx] = m;
        }
      }
      return {
        messages: merged,
        settlements: action.payload.settlements,
        dataParts: dataPartsFromMessages(merged),
        conversationId: action.payload.conversationId,
        incarnation: action.payload.incarnation ?? state.incarnation,
        live: state.live,
      };
    }
    case 'append': {
      const idx = state.messages.findIndex((m) => m.id === action.payload.id);
      let messages: ConversationMessage[];
      if (idx === -1) {
        messages = [...state.messages, action.payload];
      } else {
        messages = [...state.messages];
        messages[idx] = action.payload;
      }
      let dataParts = state.dataParts;
      for (const { name, data } of collectDataParts(action.payload.parts)) {
        dataParts = upsertDataPart(dataParts, name, data);
      }
      return { ...state, messages, dataParts };
    }
    case 'data-part':
      return {
        ...state,
        dataParts: upsertDataPart(state.dataParts, action.payload.name, action.payload.data),
      };
    case 'live-start':
      return {
        ...state,
        live: {
          messageId: action.payload.messageId,
          submissionId: action.payload.submissionId,
          turnId: action.payload.turnId,
          text: '',
        },
      };
    case 'live-delta': {
      const live = state.live;
      if (!live || live.messageId !== action.payload.messageId || action.payload.kind !== 'text') {
        return state;
      }
      return { ...state, live: { ...live, text: live.text + action.payload.delta } };
    }
    case 'live-complete': {
      const live = state.live;
      if (!live || live.messageId !== action.payload.messageId) return state;
      const message: ConversationMessage = {
        id: live.messageId,
        role: 'assistant',
        purpose: 'assistant',
        display: 'visible',
        submissionId: live.submissionId,
        turnId: live.turnId,
        parts: [{ type: 'text', text: live.text, state: 'done' }],
      };
      const idx = state.messages.findIndex((m) => m.id === live.messageId);
      let messages: ConversationMessage[];
      if (idx === -1) {
        messages = [...state.messages, message];
      } else {
        messages = [...state.messages];
        const existingParts = state.messages[idx]?.parts;
        const hasText = !!(existingParts && existingParts.some((p) => p.text && p.text.trim()));
        messages[idx] = hasText && !live.text ? state.messages[idx]! : message;
      }
      return {
        ...state,
        messages,
        live: null,
      };
    }
    case 'settled': {
      const { submissionId, outcome, answeredBySubmissionId } = action.payload;
      const existing = state.settlements.some((s) => s.submissionId === submissionId);
      const settlement: Settlement = { submissionId, outcome, answeredBySubmissionId };
      return {
        ...state,
        settlements: existing
          ? state.settlements.map((s) => (s.submissionId === submissionId ? settlement : s))
          : [...state.settlements, settlement],
      };
    }
    default:
      return state;
  }
}

let logSeq = 0;

export function useLiveConversation(instanceId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastControl, setLastControl] = useState<StreamControl | null>(null);

  const offsetRef = useRef('-1');
  const streamVersion = useRef(0);
  const statusRef = useRef<StreamStatus>('idle');
  const incarnationRef = useRef<string | null>(null);

  const pushLog = useCallback((kind: string, detail: string, outcome?: string) => {
    const entry: LogEntry = {
      id: ++logSeq,
      ts: new Date().toLocaleTimeString(),
      kind,
      detail,
      outcome,
    };
    setLog((prev) => [...prev.slice(-400), entry]);
  }, []);

  const applySnapshot = useCallback((c: Conversation) => {
    if (c.incarnation) incarnationRef.current = c.incarnation;
    if (c.offset !== undefined && c.offset !== null) offsetRef.current = c.offset;
    dispatch({ type: 'snapshot', payload: c });
  }, []);

  const handleItems = useCallback(
    (items: StreamItem[]) => {
      for (const item of items) {
        switch (item.type) {
          case 'stream-checkpoint':
            // Every SSE (re)connect starts with a checkpoint. Do NOT reset the
            // conversation here: reconnects resume from the current offset and
            // only replay events after it, so a reset would wipe earlier
            // history. Track the incarnation so server-side stream resets can
            // be surfaced; a reset to a whole new stream is reconciled via the
            // 416 path below (re-fetch full history) or a `conversation-reset`
            // snapshot.
            if (item.incarnation && item.incarnation !== incarnationRef.current) {
              incarnationRef.current = item.incarnation;
              pushLog('checkpoint', `stream incarnation ${item.incarnation}`);
            }
            break;
          case 'conversation-reset':
            pushLog('reset', 'conversation stream reset');
            applySnapshot(item.snapshot);
            break;
          case 'message-appended': {
            const role = item.message.role;
            const text = item.message.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p.text ?? '').slice(0, 160))
              .join(' ')
              .trim();
            pushLog('message', `${role}: ${text || '(no text parts)'}`);
            dispatch({ type: 'append', payload: item.message });
            break;
          }
          case 'message-started':
            pushLog('thinking', 'assistant turn started');
            dispatch({
              type: 'live-start',
              payload: {
                messageId: item.messageId,
                submissionId: item.submissionId,
                turnId: item.turnId,
              },
            });
            break;
          case 'message-delta':
            dispatch({
              type: 'live-delta',
              payload: { messageId: item.messageId, kind: item.kind, delta: item.delta },
            });
            break;
          case 'message-completed':
            dispatch({
              type: 'live-complete',
              payload: { messageId: item.messageId, timestamp: item.timestamp },
            });
            pushLog('complete', 'assistant turn completed');
            break;
          case 'message-metadata':
            pushLog('metadata', `message ${item.messageId} metadata updated`);
            break;
          case 'submission-settled':
            dispatch({
              type: 'settled',
              payload: {
                submissionId: item.submissionId,
                outcome: item.outcome,
                answeredBySubmissionId: item.answeredBySubmissionId,
              },
            });
            pushLog('settled', `submission ${item.submissionId}`, item.outcome);
            break;
          case 'data-part': {
            const detail =
              typeof item.data === 'string'
                ? item.data
                : JSON.stringify(item.data ?? '').slice(0, 240);
            pushLog('data', `data-part ${item.name}: ${detail}`);
            dispatch({ type: 'data-part', payload: { name: item.name, data: item.data } });
            break;
          }
          default: {
            const loose = item as {
              kind?: string;
              type: string;
              label?: string;
              tool?: string;
              text?: string;
            };
            const kind = loose.kind ?? loose.type;
            const label = loose.label ?? loose.tool ?? loose.text ?? '';
            pushLog(kind, label ? String(label).slice(0, 240) : `${loose.type} event`);
          }
        }
      }
    },
    [applySnapshot, pushLog],
  );

  const stopStream = useCallback(() => {
    streamVersion.current += 1;
  }, []);

  const startStream = useCallback(
    (id: string, version = ++streamVersion.current) => {
      let abort: AbortController | null = null;
      let retry = 0;

      const loop = async () => {
        while (streamVersion.current === version) {
          abort = new AbortController();
          try {
            await streamUpdates(
              id,
              offsetRef.current,
              abort.signal,
              handleItems,
              (control) => {
                offsetRef.current = control.streamNextOffset;
                setLastControl(control);
              },
            );
            retry = 0;
          } catch (err) {
            if (streamVersion.current !== version) return;
            const status = err instanceof ApiError ? err.status : 0;
            const message =
              err instanceof Error ? err.message : String(err);
            if (status === 404) {
              setStatus('new');
              setError(null);
              retry = 0;
              await sleep(2000);
              continue;
            }
            if (status === 416) {
              retry = 0;
              try {
                const conv = await fetchConversation(id);
                if (streamVersion.current !== version) return;
                dispatch({ type: 'reset' });
                applySnapshot(conv);
                setStatus('live');
                statusRef.current = 'live';
                setError(null);
                pushLog('reset', 'stream offset was reset — re-read history and resumed');
                continue;
              } catch (err2) {
                if (streamVersion.current !== version) return;
                setError(err2 instanceof Error ? err2.message : String(err2));
              }
            }
            setError(message);
            retry = Math.min(retry + 1, 8);
          }
          if (streamVersion.current !== version) return;
          await sleep(400 * retry + 300);
        }
      };
      void loop();

      return () => {
        abort?.abort();
      };
    },
    [applySnapshot, handleItems, pushLog],
  );

  const load = useCallback(
    async (id: string) => {
      const version = ++streamVersion.current;
      dispatch({ type: 'reset' });
      setLog([]);
      setError(null);
      offsetRef.current = '-1';
      setStatus('loading');
      statusRef.current = 'loading';
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        let conv: Conversation;
        try {
          conv = await fetchConversation(id, controller.signal);
        } catch (err) {
          if (streamVersion.current !== version) return;
          if (controller.signal.aborted) {
            throw new Error('Timed out loading conversation — is the orchestrator running?');
          }
          throw err;
        } finally {
          clearTimeout(timer);
        }
        if (streamVersion.current !== version) return;

        applySnapshot(conv);
        setStatus('live');
        statusRef.current = 'live';
        startStream(id, version);
      } catch (err) {
        if (streamVersion.current !== version) return;
        if (err instanceof ApiError && err.status === 404) {
          setStatus('new');
          statusRef.current = 'new';
          setError(null);
          return;
        }
        setStatus('error');
        statusRef.current = 'error';
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [applySnapshot, startStream],
  );

  useEffect(() => {
    if (!instanceId) {
      setStatus('idle');
      return;
    }
    void load(instanceId);
    return () => stopStream();
  }, [instanceId, load, stopStream]);

  const sendMessage = useCallback(
    async (body: string): Promise<void> => {
      if (!instanceId || !body.trim()) return;
      await submitMessage(instanceId, body.trim());
      if (statusRef.current !== 'live') {
        setStatus('live');
        statusRef.current = 'live';
        startStream(instanceId);
      }
    },
    [instanceId, startStream],
  );

  const refresh = useCallback(async () => {
    if (!instanceId) return;
    try {
      const conv = await fetchConversation(instanceId);
      applySnapshot(conv);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [instanceId, applySnapshot]);

  return {
    status,
    error,
    log,
    lastControl,
    messages: state.messages,
    settlements: state.settlements,
    dataParts: state.dataParts,
    conversationId: state.conversationId,
    live: state.live,
    working: status === 'live' && state.live !== null,
    sendMessage,
    refresh,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
