import { defineTool } from "@nowarelabs/agents";
import * as v from "valibot";

const inputSchema = v.object({
  command: v.string(),
  cwd: v.optional(v.string()),
  timeoutMs: v.optional(v.number()),
});

const outputSchema = v.object({
  stdout: v.string(),
  stderr: v.string(),
  exitCode: v.number(),
});

export const sandboxExecTool = defineTool({
  name: "sandbox_exec_tool",
  description:
    "Run a shell command in the agent's live sandbox and return stdout, stderr, and the exit code. The sandbox has a real working tree that persists across the conversation. Use for builds, tests, package installs, lint runs, and any command the task needs. Prefer this over guessing what a tool would return.",
  input: { parse: (raw: unknown) => v.parse(inputSchema, raw) },
  output: { parse: (raw: unknown) => v.parse(outputSchema, raw) },
  harness: true,
  async run({ harness, data, log }) {
    log.info("sandbox.exec", { command: data.command, cwd: data.cwd });
    const h = harness as {
      sandbox: {
        exec: (
          cmd: string,
          opts: unknown,
        ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      };
    };
    const result = await h.sandbox.exec(data.command, {
      cwd: data.cwd,
      timeoutMs: data.timeoutMs,
    });
    return result;
  },
});
