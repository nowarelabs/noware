import {
  createProvider,
  type AssistantMessage,
  type AssistantMessageEvent,
  type AssistantMessageEventStream,
  type ToolCall,
} from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

export const OLLAMA_PROVIDER_ID = 'ollama';
export const OLLAMA_BASE_URL = 'http://localhost:11434/v1';
export const OLLAMA_MODEL = 'qwen2.5-coder:7b';

/** Longest plausible tool-call JSON before we give up and treat it as prose. */
const MAX_TOOL_BUFFER = 2048;

interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * qwen2.5-coder via Ollama does not emit native OpenAI `tool_calls` — its chat
 * template serializes a call as pure JSON text in `content`, e.g.
 * `{"name": "get_tickets", "arguments": {...}}`. pi-ai (and Flue) expect a
 * `toolCall` content block. This adapter rewrites a response whose text is
 * exactly that JSON into the pi-ai `toolcall_*` event sequence so the agent's
 * tool loop works. Prose responses stream through untouched.
 */
function parseToolCallText(text: string): ParsedToolCall | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const name = record.name;
  const args = (record.arguments ?? record.parameters) as unknown;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return null;
  return { name, arguments: args as Record<string, unknown> };
}

function buildToolMessage(done: AssistantMessage, call: ParsedToolCall, id: string): AssistantMessage {
  const block: ToolCall = { type: 'toolCall', id, name: call.name, arguments: call.arguments };
  return { ...done, content: [block], stopReason: 'toolUse' };
}

function toolCallId(): string {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

function* emitToolCallSequence(message: AssistantMessage, call: ParsedToolCall): Generator<AssistantMessageEvent> {
  yield { type: 'toolcall_start', contentIndex: 0, partial: message };
  yield { type: 'toolcall_delta', contentIndex: 0, delta: JSON.stringify(call.arguments), partial: message };
  yield { type: 'toolcall_end', contentIndex: 0, toolCall: message.content[0] as ToolCall, partial: message };
  yield { type: 'done', reason: 'toolUse', message };
}

async function* transformOllamaTools(stream: AssistantMessageEventStream): AsyncGenerator<AssistantMessageEvent> {
  const inner = stream[Symbol.asyncIterator]();
  const pending: AssistantMessageEvent[] = [];
  let held: AssistantMessageEvent[] = [];
  let buffer = '';
  let holding = false;

  const flushHeld = (): void => {
    for (const ev of held) pending.push(ev);
    held = [];
    buffer = '';
    holding = false;
  };

  while (true) {
    if (pending.length > 0) {
      yield pending.shift()!;
      continue;
    }
    const result = await inner.next();
    if (result.done) {
      if (holding) flushHeld();
      return;
    }
    const ev = result.value;
    switch (ev.type) {
      case 'start':
        yield ev;
        break;
      case 'text_start':
        held.push(ev);
        break;
      case 'text_delta': {
        if (!holding) {
          held.push(ev);
          buffer += ev.delta;
          holding = buffer.trimStart().startsWith('{');
          if (!holding) {
            flushHeld();
            pending.push(ev);
          }
        } else if (buffer.length < MAX_TOOL_BUFFER && !parseToolCallText(buffer)) {
          buffer += ev.delta;
          held.push(ev);
        } else if (parseToolCallText(buffer) && ev.delta.trim().length === 0) {
          buffer += ev.delta;
          held.push(ev);
        } else {
          flushHeld();
          pending.push(ev);
        }
        break;
      }
      case 'text_end':
        held.push(ev);
        break;
      case 'done': {
        if (holding) {
          const call = parseToolCallText(buffer);
          if (call) {
            yield* emitToolCallSequence(buildToolMessage(ev.message, call, toolCallId()), call);
            return;
          }
          flushHeld();
        }
        yield ev;
        return;
      }
      case 'error': {
        if (holding) flushHeld();
        yield ev;
        return;
      }
      default:
        if (holding) flushHeld();
        yield ev;
        break;
    }
  }
}

function textFromMessage(message: AssistantMessage): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('');
}

function withOllamaToolAdapter(stream: AssistantMessageEventStream): AssistantMessageEventStream {
  const iterable = transformOllamaTools(stream);
  return {
    [Symbol.asyncIterator]: () => iterable,
    result: async () => {
      const message = await stream.result();
      const call = parseToolCallText(textFromMessage(message));
      return call ? buildToolMessage(message, call, toolCallId()) : message;
    },
  } as unknown as AssistantMessageEventStream;
}

/**
 * Pi provider for a local Ollama server. Register it in the agent's `app.ts`:
 *
 * ```ts
 * import { setProvider } from '@flue/runtime';
 * import { ollamaProvider, OLLAMA_MODEL } from '@nowarelabs/ollama-provider';
 *
 * setProvider(ollamaProvider());
 * // agents use `useModel('ollama/qwen2.5-coder:7b')`
 * ```
 *
 * Per docs/guide/05-models.md "Custom providers": full Model objects, each
 * carrying its own baseUrl (no provider-level endpoint).
 */
export function ollamaProvider() {
  return createProvider({
    id: OLLAMA_PROVIDER_ID,
    name: 'Ollama (local)',
    // Keyless local server. Flue's documented Ollama recipe resolves to
    // `{ auth: {} }`, but pi-ai 0.83.0 then throws "No API key for provider:
    // ollama" (getClientApiKey), so we supply a placeholder key that Ollama
    // ignores. Use envApiKeyAuth('...', ['MY_KEY']) for a real key.
    auth: {
      apiKey: {
        name: 'Ollama local (keyless)',
        resolve: async () => ({ auth: { apiKey: 'ollama' }, source: 'local Ollama' }),
      },
    },
    models: [
      {
        id: OLLAMA_MODEL,
        name: 'qwen2.5 Coder 7B',
        api: 'openai-completions',
        provider: OLLAMA_PROVIDER_ID,
        baseUrl: OLLAMA_BASE_URL,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32768,
        maxTokens: 32768,
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
          maxTokensField: 'max_tokens',
          supportsStrictMode: false,
        },
      },
    ],
    api: {
      stream: (model, context, options) => withOllamaToolAdapter(openAICompletionsApi().stream(model, context, options)),
      streamSimple: (model, context, options) => withOllamaToolAdapter(openAICompletionsApi().streamSimple(model, context, options)),
    },
  });
}
