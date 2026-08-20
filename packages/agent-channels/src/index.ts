/**
 * @nowarelabs/agent-channels — communication channels for agents.
 *
 * Channels are the mediums through which agents communicate with humans
 * and other agents. Each channel is a Port (contract) implemented by
 * a Gateway (deliverer).
 *
 * ## Convention
 *
 * One port + one gateway per channel type:
 * ```typescript
 * interface ISlackChannelPort extends Port<SlackMessage, MessageReceipt> {}
 * class SlackChannelGateway extends BaseGateway implements ISlackChannelPort { ... }
 * ```
 *
 * ## Data flow (unidirectional)
 *
 * ```
 * AgentRuntime → ChannelPort → ChannelGateway → External (Slack, Email, RPC, etc.)
 * ```
 *
 * ## Channel types
 *
 * - **Human channels**: Slack, Email, Discord, Telegram, Webhook
 * - **Agent channels**: AgentRpc (service bindings), Queue (message queues)
 * - **Hybrid channels**: HitlChannel (human-in-the-loop via D1)
 */

import { BaseGateway } from "@nowarelabs/gateways";
import type { UseCaseResult } from "@nowarelabs/shared";

// ----------------------------------------------------------------
// Base channel interface
// ----------------------------------------------------------------

export interface OutboundMessage {
  channelType: string;
  channelId: string;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface MessageReceipt {
  messageId: string;
  channelType: string;
  channelId: string;
  sentAt: number;
}

export interface InboundMessage {
  messageId: string;
  channelType: string;
  channelId: string;
  sender: string;
  body: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelPort {
  send(message: OutboundMessage): Promise<UseCaseResult<MessageReceipt>>;
}

// ----------------------------------------------------------------
// Slack channel
// ----------------------------------------------------------------

export interface SlackMessage extends OutboundMessage {
  channelType: "slack";
  threadTs?: string;
  blocks?: unknown[];
}

export interface ISlackChannelPort extends ChannelPort {
  send(message: SlackMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class SlackChannelGateway extends BaseGateway implements ISlackChannelPort {
  async send(message: SlackMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const binding = (this as unknown as { env: Record<string, unknown> }).env.SLACK_BOT;
      const rpc = binding as Record<string, (input: unknown) => Promise<{ ts: string }>>;
      const result = await rpc.postMessage({
        channel: message.channelId,
        text: message.body,
        thread_ts: message.threadTs,
        blocks: message.blocks,
      });
      return {
        success: true,
        data: {
          messageId: result.ts,
          channelType: "slack",
          channelId: message.channelId,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

// ----------------------------------------------------------------
// Email channel
// ----------------------------------------------------------------

export interface EmailMessage extends OutboundMessage {
  channelType: "email";
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

export interface IEmailChannelPort extends ChannelPort {
  send(message: EmailMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class EmailChannelGateway extends BaseGateway implements IEmailChannelPort {
  async send(message: EmailMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const binding = (this as unknown as { env: Record<string, unknown> }).env.EMAIL_SERVICE;
      const rpc = binding as Record<string, (input: unknown) => Promise<{ id: string }>>;
      const result = await rpc.sendEmail({
        from: message.from ?? "agent@noware.dev",
        to: message.recipient,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject ?? "",
        body: message.body,
        replyTo: message.replyTo,
      });
      return {
        success: true,
        data: {
          messageId: result.id,
          channelType: "email",
          channelId: message.channelId,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

// ----------------------------------------------------------------
// Agent-to-agent RPC channel
// ----------------------------------------------------------------

export interface AgentRpcMessage extends OutboundMessage {
  channelType: "agent-rpc";
  agentName: string;
  task: string;
  conversationId?: string;
}

export interface IAgentRpcChannelPort extends ChannelPort {
  send(message: AgentRpcMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class AgentRpcChannelGateway extends BaseGateway implements IAgentRpcChannelPort {
  async send(message: AgentRpcMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const env = (this as unknown as { env: Record<string, unknown> }).env;
      const bindingName = `${message.agentName.toUpperCase().replace(/-/g, "_")}_AGENT`;
      const binding = env[bindingName] as unknown as { fetch: (req: Request) => Promise<Response> };
      const _response = await binding.fetch(
        new Request(`https://internal/agents/${message.agentName}`, {
          method: "POST",
          body: JSON.stringify({
            conversationId: message.conversationId ?? "default",
            messages: [{ role: "user", content: message.body }],
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      return {
        success: true,
        data: {
          messageId: `rpc-${Date.now()}`,
          channelType: "agent-rpc",
          channelId: message.agentName,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

// ----------------------------------------------------------------
// Webhook channel
// ----------------------------------------------------------------

export interface WebhookMessage extends OutboundMessage {
  channelType: "webhook";
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
}

export interface IWebhookChannelPort extends ChannelPort {
  send(message: WebhookMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class WebhookChannelGateway extends BaseGateway implements IWebhookChannelPort {
  async send(message: WebhookMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const response = await fetch(message.url, {
        method: message.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          ...message.headers,
        },
        body: JSON.stringify({
          subject: message.subject,
          body: message.body,
          metadata: message.metadata,
        }),
      });
      return {
        success: true,
        data: {
          messageId: `wh-${response.status}-${Date.now()}`,
          channelType: "webhook",
          channelId: message.url,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

// ----------------------------------------------------------------
// Human-in-the-loop channel (D1-backed)
// ----------------------------------------------------------------

export interface HitlMessage extends OutboundMessage {
  channelType: "hitl";
  conversationId: string;
  options?: string[];
  expiresAt?: number;
}

export interface IHitlChannelPort extends ChannelPort {
  send(message: HitlMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class HitlChannelGateway extends BaseGateway implements IHitlChannelPort {
  async send(message: HitlMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const env = (this as unknown as { env: Record<string, unknown> }).env;
      const db = env.FLAX_DB as {
        prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } };
      };
      const hitlId = `hitl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db
        .prepare(
          `INSERT INTO flax_hitl (id, conversation_id, question, options, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          hitlId,
          message.conversationId,
          message.body,
          JSON.stringify(message.options ?? []),
          Date.now(),
          message.expiresAt ?? null,
        )
        .run();
      return {
        success: true,
        data: {
          messageId: hitlId,
          channelType: "hitl",
          channelId: message.conversationId,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}

// ----------------------------------------------------------------
// Queue channel (message queue)
// ----------------------------------------------------------------

export interface QueueMessage extends OutboundMessage {
  channelType: "queue";
  queueName: string;
  delayMs?: number;
  deduplicationKey?: string;
}

export interface IQueueChannelPort extends ChannelPort {
  send(message: QueueMessage): Promise<UseCaseResult<MessageReceipt>>;
}

export class QueueChannelGateway extends BaseGateway implements IQueueChannelPort {
  async send(message: QueueMessage): Promise<UseCaseResult<MessageReceipt>> {
    try {
      const env = (this as unknown as { env: Record<string, unknown> }).env;
      const queue = env[message.queueName] as unknown as {
        send: (
          body: unknown,
          opts?: { delaySeconds?: number; deduplicationKey?: string },
        ) => Promise<string>;
      };
      const messageId = await queue.send(
        {
          subject: message.subject,
          body: message.body,
          metadata: message.metadata,
        },
        {
          delaySeconds: message.delayMs ? Math.ceil(message.delayMs / 1000) : undefined,
          deduplicationKey: message.deduplicationKey,
        },
      );
      return {
        success: true,
        data: {
          messageId,
          channelType: "queue",
          channelId: message.queueName,
          sentAt: Date.now(),
        },
        status: "delivered",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        status: "abandoned",
      };
    }
  }
}
