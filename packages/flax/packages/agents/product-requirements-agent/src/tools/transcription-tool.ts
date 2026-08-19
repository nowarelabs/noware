import { defineTool } from '@nowarelabs/agents';
import { env } from 'cloudflare:workers';
import * as v from 'valibot';

type RpcCallable = Record<string, (input: unknown) => Promise<unknown>>;

export const transcriptionTool = defineTool({
  name: 'transcription_tool',
  description:
    'Call methods on the transcription-tool service via its RPC binding (TRANSCRIPTION_TOOL). Methods: transcribeAudio, summarizeCall. Pass `method` (one of those names) and `args` (an object matching the tool method input).',
  input: v.object({
    method: v.picklist(['transcribeAudio','summarizeCall']),
    args: v.optional(v.unknown()),
  }),
  output: v.any(),
  async run({ data, log }) {
    const rpc = (env as unknown as { TRANSCRIPTION_TOOL: RpcCallable }).TRANSCRIPTION_TOOL;
    const result = await rpc[data.method](data.args);
    log.info('tool.invoked', { tool: 'transcription_tool', method: data.method });
    return { output: result };
  },
});
