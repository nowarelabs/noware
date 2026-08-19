'use agent';

import {
  useAgentFinish,
  useAgentStart,
  useDataWriter,
  useDelivery,
  useInitialData,
  useInstruction,
  useModel,
  usePersistentState,
  useResponseFinish,
  useResponseStart,
  useSandbox,
  useSkill,
  useSubagent,
  useTool,
  bash,
  GeneralSubagent,
} from '@nowarelabs/agents';
import * as v from 'valibot';
import { Bash, InMemoryFs } from 'just-bash';

import { githubTool } from '../tools/github-tool';
import { lintLangserverTool } from '../tools/lint-langserver-tool';
import { packageManagerTool } from '../tools/package-manager-tool';
import { sandboxExecTool } from '../tools/sandbox-exec-tool';

interface WorktreeState {
  status: 'idle' | 'implementing' | 'done';
  branch: string;
  changedFiles: string[];
}

export function Coding() {
  useModel('cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct', {
    thinkingLevel: 'medium',
    compaction: { keepRecentTokens: 16000 },
  });

  useInstruction(
    'Implement features idiomatically in the target stack and match the codebase existing patterns. Locate relevant modules, follow the existing architecture, preserve module boundaries, and prefer extending existing seams over creating parallel abstractions. Pin compatible dependency versions, keep the lockfile in sync, prefer minimal additions, and check for known vulnerabilities before merging. Use small focused commits with conventional commit messages, feature branches, and the merge/rebase strategy the repo uses. Keep changes small and reviewable, run lint and tests in the sandbox after changing code, and never commit secrets, credentials, or build artifacts.',
  );

  const [worktree, setWorktree] = usePersistentState<WorktreeState>('worktree', {
    status: 'idle',
    branch: '',
    changedFiles: [],
  });

  const writeCoding = useDataWriter('coding', {
    schema: v.object({
      status: v.picklist(['idle', 'implementing', 'done']),
      branch: v.string(),
      changedFiles: v.array(v.string()),
    }),
  });

  const delivery = useDelivery();
  const initialData = useInitialData<{ repo?: string; branch?: string; issue?: string }>();

  useAgentStart(({ log }) => {
    const branch = worktree.branch || initialData?.branch || (delivery.kind === 'signal' ? delivery.attributes?.branch : undefined) || 'main';
    log.info('coding.started', { branch, repo: initialData?.repo, issue: initialData?.issue });
    setWorktree((prev) => ({ ...prev, status: 'implementing', branch }));
    writeCoding({ status: 'implementing', branch, changedFiles: worktree.changedFiles });
  });

  useResponseStart(() => ({ startedAt: Date.now() }));

  useResponseFinish(({ metadata, response }) => ({
    elapsedMs: Date.now() - (metadata.startedAt as number),
    toolCalls: response.toolCalls.length,
  }));

  useAgentFinish(({ log, response }) => {
    log.info('coding.finished', { toolCalls: response.toolCalls.length });
    setWorktree((prev) => ({ ...prev, status: 'done' }));
    writeCoding({ status: 'done', branch: worktree.branch, changedFiles: worktree.changedFiles });
  });

  useSandbox(bash(() => new Bash({ fs: new InMemoryFs({}) })));

  useSubagent(GeneralSubagent);
  useTool(githubTool);
  useTool(lintLangserverTool);
  useTool(packageManagerTool);
  useTool(sandboxExecTool);

  return `You are the Coding agent. Implement features idiomatically in the target stack, match the codebase's existing patterns, and keep changes small and reviewable. Work inside the sandbox: inspect files, run builds and tests, and verify changes before committing. Manage dependencies deliberately and commit according to the repo's git conventions. Use the sandbox exec tool for any command the task needs.`;
}
