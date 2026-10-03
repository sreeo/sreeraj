/**
 * One-shot agent helpers for the older automation modules (trend discovery, vision gate,
 * design generator). They run through pipeline/agent.ts, so each call works on Claude Code or
 * Codex with the role's fallback order, on the host's subscription logins.
 */
import { runAgent } from './pipeline/agent.js';

export { agentEnv } from './pipeline/agent.js';

export interface AgentJsonOpts {
  /** Agent role from pipeline/roles.json. Inferred from allowedTools when omitted. */
  role?: string;
  /** Legacy hint: 'WebSearch' → trend role, 'Read' → vision_gate role. */
  allowedTools?: string[];
  /** Image files the agent must look at. */
  images?: string[];
  maxTurns?: number;
  cwd?: string;
  label?: string;
}

function roleFor(opts: AgentJsonOpts): string {
  if (opts.role) return opts.role;
  if (opts.allowedTools?.includes('WebSearch')) return 'trend';
  if (opts.allowedTools?.includes('Read') || opts.images?.length) return 'vision_gate';
  return 'judge';
}

/**
 * Run one agent call that must return JSON matching `schema`.
 * Returns the parsed object, or null if no provider produced valid output.
 */
export async function agentJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: AgentJsonOpts = {},
): Promise<T | null> {
  const result = await runAgent<T>({
    role: roleFor(opts),
    label: opts.label,
    prompt,
    schema,
    images: opts.images,
    cwd: opts.cwd,
  });
  return result.ok ? (result.data ?? null) : null;
}

/** Run one agent call and return its final text (for free-form generation like CSS). */
export async function agentText(prompt: string, opts: AgentJsonOpts = {}): Promise<string> {
  const result = await runAgent({ role: roleFor(opts), label: opts.label, prompt, images: opts.images, cwd: opts.cwd });
  return result.ok ? (result.text ?? '') : '';
}
