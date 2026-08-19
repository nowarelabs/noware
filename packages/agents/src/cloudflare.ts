/**
 * Cloudflare-specific adapters for the agent DSL.
 *
 * This module provides the bridge between our hook-based DSL and
 * Cloudflare's `agents` package. It generates DO classes from
 * AgentDefinitions and wires up the runtime.
 */

import type { AgentDefinition, ToolDefinition } from "./types.js";
import { extractContext } from "./agent.js";

// ----------------------------------------------------------------
// Cloudflare Agent types (structural, avoid direct import)
// ----------------------------------------------------------------

export interface CloudflareAgentLike {
  state: Record<string, unknown>;
  setState(state: Record<string, unknown>): void;
  onStart?(props?: Record<string, unknown>): Promise<void> | void;
  onConnect?(connection: unknown, ctx?: unknown): Promise<void> | void;
  onMessage?(connection: unknown, message: unknown): Promise<void> | void;
  onClose?(connection: unknown): Promise<void> | void;
  onError?(connection: unknown, error: unknown): void | Promise<void>;
  alarm?(): Promise<void>;
  fetch?(request: Request): Promise<Response>;
  schedule?(when: Date | string | number, callback: string, payload?: unknown): Promise<unknown>;
  scheduleEvery?(intervalSeconds: number, callback: string, payload?: unknown): Promise<unknown>;
  queue?<T>(callback: string, payload: T): Promise<string>;
  sql?<T>(strings: TemplateStringsArray, ...values: unknown[]): T[];
  retry?<T>(fn: () => Promise<T>, options?: { retries?: number; delay?: number }): Promise<T>;
}

// ----------------------------------------------------------------
// Tool execution adapter
// ----------------------------------------------------------------

/**
 * Executes a tool definition in a Cloudflare Agent context.
 * Handles durable step execution via `step.do()` if the tool is durable.
 */
export async function executeTool(
  tool: ToolDefinition,
  input: unknown,
  ctx: {
    log: { info: typeof console.log; warn: typeof console.warn; error: typeof console.error };
    step?: { do: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
  },
): Promise<unknown> {
  const parsed = tool.input?.parse(input) ?? input;
  const runCtx = {
    data: parsed as Record<string, unknown>,
    log: ctx.log,
    ...(ctx.step ? { step: ctx.step } : {}),
  };
  const result = await (tool as unknown as { run: (ctx: typeof runCtx) => Promise<unknown> }).run(
    runCtx,
  );
  return tool.output?.parse(result) ?? result;
}

// ----------------------------------------------------------------
// System prompt builder
// ----------------------------------------------------------------

/**
 * Builds a system prompt from an agent definition.
 * Combines instructions, tool descriptions, and skill catalogs.
 */
export function buildSystemPrompt(def: AgentDefinition): string {
  const parts: string[] = [];

  // Agent instructions
  if (def.instructions) {
    parts.push(def.instructions);
  }

  // Tool catalog
  if (def.tools.length > 0) {
    parts.push("\n## Available Tools");
    for (const tool of def.tools) {
      parts.push(`\n### ${tool.name}\n${tool.description}`);
    }
  }

  // Skill catalog (names only, full content loaded on activation)
  if (def.skills.length > 0) {
    parts.push("\n## Available Skills");
    for (const skill of def.skills) {
      parts.push(`\n- **${skill.name}**: ${skill.description}`);
    }
  }

  // Subagent catalog
  if (def.subagents.length > 0) {
    parts.push("\n## Available Subagents");
    for (const sub of def.subagents) {
      parts.push(`\n- **${sub.name}**: ${sub.description}`);
    }
  }

  return parts.join("\n");
}

// ----------------------------------------------------------------
// Class generation
// ----------------------------------------------------------------

export interface GeneratedAgentClass {
  className: string;
  agentName: string;
  definition: AgentDefinition;
}

/**
 * Prepares an AgentDefinition for Cloudflare DO class generation.
 * Returns the metadata needed to create the DO class at build time.
 */
export function prepareForCloudflare(def: AgentDefinition): GeneratedAgentClass {
  const ctx = extractContext(def);

  return {
    className: def.className,
    agentName: def.name,
    definition: {
      ...def,
      tools: ctx.tools,
      skills: ctx.skills,
      subagents: ctx.subagents,
    },
  };
}
