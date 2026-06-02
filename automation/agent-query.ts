/**
 * Thin helper around the Claude Agent SDK for one-shot structured queries.
 *
 * Everything Claude-powered in the automation runs through the Agent SDK so it
 * authenticates with the Claude Code session (subscription/OAuth) — no raw
 * ANTHROPIC_API_KEY required. Replaces direct `@anthropic-ai/sdk` usage.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { CONFIG } from './config.js';

export interface AgentJsonOpts {
  allowedTools?: string[];
  maxTurns?: number;
  model?: string;
  cwd?: string;
}

/**
 * Run a single Agent SDK query that must return JSON matching `schema`.
 * Returns the validated object, or null if the run produced no structured output.
 */
export async function agentJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: AgentJsonOpts = {},
): Promise<T | null> {
  let result: T | null = null;

  for await (const message of query({
    prompt,
    options: {
      cwd: opts.cwd ?? CONFIG.projectRoot,
      model: opts.model ?? CONFIG.layoutQa.fixerModel,
      maxTurns: opts.maxTurns ?? 8,
      allowedTools: opts.allowedTools ?? [],
      permissionMode: 'acceptEdits',
      outputFormat: { type: 'json_schema', schema },
    },
  })) {
    if (
      message.type === 'result' &&
      (message as { subtype?: string }).subtype === 'success' &&
      (message as { structured_output?: unknown }).structured_output
    ) {
      result = (message as { structured_output: T }).structured_output;
    }
  }

  return result;
}

/**
 * Run a single Agent SDK query and return its final text output (for free-form
 * generation like CSS). Defaults to no tools and one turn.
 */
export async function agentText(prompt: string, opts: AgentJsonOpts = {}): Promise<string> {
  let out = '';

  for await (const message of query({
    prompt,
    options: {
      cwd: opts.cwd ?? CONFIG.projectRoot,
      model: opts.model ?? CONFIG.layoutQa.fixerModel,
      maxTurns: opts.maxTurns ?? 1,
      allowedTools: opts.allowedTools ?? [],
      permissionMode: 'acceptEdits',
    },
  })) {
    if (message.type === 'result' && (message as { subtype?: string }).subtype === 'success') {
      out = (message as { result?: string }).result ?? out;
    }
  }

  return out;
}
