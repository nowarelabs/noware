import { defineTool } from '@nowarelabs/agents';
import * as v from 'valibot';

export const sandboxExecTool = defineTool({
  name: 'sandbox_exec_tool',
  description:
    'Run a shell command in the agent\'s live sandbox and return stdout, stderr, and the exit code. The sandbox has a real working tree that persists across the conversation. Use for builds, tests, package installs, lint runs, and any command the task needs. Prefer this over guessing what a tool would return.',
  input: v.object({
    command: v.string(),
    cwd: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
  }),
  output: v.object({
    stdout: v.string(),
    stderr: v.string(),
    exitCode: v.number(),
  }),
  harness: true,
  async run({ harness, data, log }) {
    log.info('sandbox.exec', { command: data.command, cwd: data.cwd });
    const result = await harness.sandbox.exec(data.command, {
      cwd: data.cwd,
      timeoutMs: data.timeoutMs,
    });
    return { output: result };
  },
});
