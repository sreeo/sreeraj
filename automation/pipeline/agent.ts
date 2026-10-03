/**
 * Provider-neutral agent calls for the redesign pipeline.
 *
 * Every agent step goes through runAgent(): it runs the Claude Code CLI (`claude -p`) or the
 * Codex CLI (`codex exec`) on the host's subscription logins, tries the providers in the role's
 * order (pipeline/roles.json), and moves to the next provider on a login error, rate limit,
 * timeout or output that fails the schema. Code decides what to do with the result; the agent
 * only does the work.
 *
 * Each call is appended to test-output/agent-calls.jsonl so the run viewer can show which
 * provider and model answered.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG } from '../config.js';

export type Provider = 'claude' | 'codex';
export type Tool = 'read' | 'edit' | 'bash' | 'web_search' | 'image';
export type FailureKind = 'auth' | 'rate_limit' | 'timeout' | 'invalid_output' | 'error';

export interface AgentTask<T = unknown> {
  role: string;
  prompt: string;
  /** JSON Schema for a typed final answer. Omit for edit-only tasks. */
  schema?: Record<string, unknown>;
  /** Extra check on the parsed answer (e.g. a zod parse). Throw to reject it. */
  validate?: (value: unknown) => T;
  /** Image files the agent must look at (screenshots). */
  images?: string[];
  cwd?: string;
  /** Short name for the call log, e.g. "researcher:pre-modern". */
  label?: string;
  /** Override the role's provider order for this call. */
  providers?: Provider[];
}

export interface Attempt {
  provider: Provider;
  model: string;
  ok: boolean;
  kind?: FailureKind;
  error?: string;
  durationMs: number;
  sessionId?: string;
}

export interface AgentResult<T = unknown> {
  ok: boolean;
  provider?: Provider;
  model?: string;
  data?: T;
  text?: string;
  sessionId?: string;
  /** The agent stopped at its turn limit; it may still have done useful work. */
  hitTurnLimit?: boolean;
  durationMs: number;
  attempts: Attempt[];
  error?: string;
}

interface RoleConfig {
  providers: Provider[];
  tools: Tool[];
  maxTurns: number;
  timeoutMin: number;
}

interface RolesFile {
  models: Record<Provider, string>;
  defaults: { providers: Provider[]; maxTurns: number; timeoutMin: number };
  roles: Record<string, Partial<RoleConfig>>;
}

const ROLES: RolesFile = JSON.parse(
  fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'roles.json'), 'utf-8'),
);

export function modelFor(provider: Provider): string {
  if (provider === 'claude') return process.env.REDESIGN_CLAUDE_MODEL || ROLES.models.claude;
  return process.env.REDESIGN_CODEX_MODEL || ROLES.models.codex;
}

export function roleConfig(role: string): RoleConfig {
  const r = ROLES.roles[role];
  if (!r) throw new Error(`unknown agent role "${role}" (see pipeline/roles.json)`);
  const forced = process.env.REDESIGN_PROVIDERS?.split(',').map(s => s.trim()).filter(Boolean) as Provider[] | undefined;
  return {
    providers: forced?.length ? forced : (r.providers ?? ROLES.defaults.providers),
    tools: r.tools ?? [],
    maxTurns: r.maxTurns ?? ROLES.defaults.maxTurns,
    timeoutMin: r.timeoutMin ?? ROLES.defaults.timeoutMin,
  };
}

/**
 * Environment for agent processes.
 *
 * Claude Code does not pass CLAUDE_CODE_OAUTH_TOKEN to commands its Bash tool runs, so a step
 * started from inside the rebuild would fall back to the interactive login, which expires.
 * When the token is missing, read it from the runner's env file.
 */
export function agentEnv(): Record<string, string | undefined> {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) return process.env;
  const file = process.env.REDESIGN_ENV_FILE ?? path.join(os.homedir(), '.config/sreeraj-redesign/env');
  try {
    const line = fs
      .readFileSync(file, 'utf-8')
      .split('\n')
      .find(l => l.startsWith('CLAUDE_CODE_OAUTH_TOKEN='));
    const token = line?.slice('CLAUDE_CODE_OAUTH_TOKEN='.length).trim();
    if (token) return { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token };
  } catch {
    // No env file (e.g. CI): keep the session login.
  }
  return process.env;
}

export function classify(text: string): FailureKind {
  if (/failed to authenticate|oauth|unauthori[sz]ed|\b401\b|not logged in|please log in|login required/i.test(text)) return 'auth';
  if (/rate.?limit|usage limit|\b429\b|overloaded|quota/i.test(text)) return 'rate_limit';
  return 'error';
}

interface Spawned {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function run(cmd: string, args: string[], input: string, cwd: string, timeoutMs: number): Promise<Spawned> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, env: agentEnv() as NodeJS.ProcessEnv, detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }, timeoutMs);
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', err => {
      stderr += String(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.end(input);
  });
}

const CLAUDE_TOOLS: Record<Tool, string[]> = {
  read: ['Read', 'Glob', 'Grep'],
  edit: ['Edit', 'Write'],
  bash: ['Bash'],
  web_search: ['WebSearch', 'WebFetch'],
  image: ['Read'],
};

/** Codex structured output is strict: every property required, no extra keys. */
export function strictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'description' && typeof v === 'string') out[k] = v;
    else out[k] = strictSchema(v);
  }
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.required = Object.keys(out.properties as object);
    out.additionalProperties = false;
  }
  return out;
}

export function withImages(prompt: string, images: string[] | undefined, provider: Provider): string {
  if (!images?.length) return prompt;
  if (provider === 'codex') return `${prompt}\n\nThe ${images.length} attached image(s) are, in order:\n${images.map(p => `- ${path.basename(p)}`).join('\n')}`;
  return `${prompt}\n\nOpen EVERY one of these image files with the Read tool before you answer:\n${images.map(p => `- ${p}`).join('\n')}`;
}

interface Once {
  ok: boolean;
  kind?: FailureKind;
  error?: string;
  text?: string;
  json?: unknown;
  sessionId?: string;
  hitTurnLimit?: boolean;
}

async function runClaude(task: AgentTask, cfg: RoleConfig, model: string, prompt: string, cwd: string): Promise<Once> {
  const args = ['-p', '--model', model, '--output-format', 'json', '--max-turns', String(cfg.maxTurns)];
  const tools = [...new Set(cfg.tools.flatMap(t => CLAUDE_TOOLS[t]))];
  if (cfg.tools.includes('edit') || cfg.tools.includes('bash')) args.push('--dangerously-skip-permissions');
  if (tools.length) args.push('--allowedTools', tools.join(','));
  if (task.schema) args.push('--json-schema', JSON.stringify(task.schema));

  const res = await run('claude', args, withImages(prompt, task.images, 'claude'), cwd, cfg.timeoutMin * 60_000);
  if (res.timedOut) return { ok: false, kind: 'timeout', error: `timed out after ${cfg.timeoutMin} min` };

  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(res.stdout.trim().split('\n').filter(Boolean).pop() ?? '');
  } catch {
    /* not JSON: CLI failed before producing a result */
  }
  if (!parsed) {
    const msg = (res.stderr || res.stdout).slice(-600);
    return { ok: false, kind: classify(msg), error: msg || `claude exited ${res.code}` };
  }
  const hitTurnLimit = parsed.subtype === 'error_max_turns';
  if (parsed.is_error && !hitTurnLimit) {
    const msg = String(parsed.result ?? parsed.subtype ?? 'error');
    return { ok: false, kind: classify(msg), error: msg.slice(0, 600), sessionId: parsed.session_id };
  }
  return {
    ok: true,
    text: typeof parsed.result === 'string' ? parsed.result : undefined,
    json: parsed.structured_output,
    sessionId: parsed.session_id,
    hitTurnLimit,
  };
}

async function runCodex(task: AgentTask, cfg: RoleConfig, model: string, prompt: string, cwd: string): Promise<Once> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-'));
  const outFile = path.join(tmp, 'last-message.txt');
  const args = ['exec', '--skip-git-repo-check', '-m', model, '-C', cwd, '--color', 'never', '-o', outFile];
  if (cfg.tools.includes('web_search')) args.push('-c', 'web_search="live"');
  // Edit/Bash roles get the same freedom as `claude --dangerously-skip-permissions` on this
  // dedicated host; everything else runs read-only.
  if (cfg.tools.includes('edit') || cfg.tools.includes('bash')) args.push('--dangerously-bypass-approvals-and-sandbox');
  else args.push('--sandbox', 'read-only');
  if (task.schema) {
    const schemaFile = path.join(tmp, 'schema.json');
    fs.writeFileSync(schemaFile, JSON.stringify(strictSchema(task.schema)));
    args.push('--output-schema', schemaFile);
  }
  for (const img of task.images ?? []) args.push(`--image=${img}`);
  args.push('-');

  try {
    const res = await run('codex', args, withImages(prompt, task.images, 'codex'), cwd, cfg.timeoutMin * 60_000);
    const sessionId = /session id:\s*([0-9a-f-]{20,})/i.exec(res.stderr + res.stdout)?.[1];
    if (res.timedOut) return { ok: false, kind: 'timeout', error: `timed out after ${cfg.timeoutMin} min`, sessionId };
    const text = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf-8').trim() : '';
    if (res.code !== 0 || !text) {
      const msg = (res.stderr || res.stdout).slice(-600);
      return { ok: false, kind: classify(msg), error: msg || `codex exited ${res.code}`, sessionId };
    }
    let json: unknown;
    if (task.schema) {
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, kind: 'invalid_output', error: `not JSON: ${text.slice(0, 200)}`, sessionId };
      }
    }
    return { ok: true, text, json, sessionId };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function logCall(entry: Record<string, unknown>): void {
  try {
    const file = process.env.REDESIGN_AGENT_LOG ?? path.join(CONFIG.testOutputDir, 'agent-calls.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch {
    /* the log is best-effort */
  }
}

/** Run one agent task on the first provider that succeeds. Never throws. */
export async function runAgent<T = unknown>(task: AgentTask<T>): Promise<AgentResult<T>> {
  const cfg = roleConfig(task.role);
  const providers = task.providers ?? cfg.providers;
  const cwd = task.cwd ?? CONFIG.projectRoot;
  const attempts: Attempt[] = [];
  const started = Date.now();

  for (const provider of providers) {
    const model = modelFor(provider);
    let prompt = task.prompt;
    // One repair round per provider when the answer fails the schema.
    for (let round = 0; round < 2; round++) {
      const t0 = Date.now();
      const once = provider === 'claude'
        ? await runClaude(task, cfg, model, prompt, cwd)
        : await runCodex(task, cfg, model, prompt, cwd);

      let data: T | undefined;
      if (once.ok && task.schema) {
        try {
          if (once.json === undefined || once.json === null) throw new Error('no structured output');
          data = task.validate ? task.validate(once.json) : (once.json as T);
        } catch (err) {
          once.ok = false;
          once.kind = 'invalid_output';
          once.error = err instanceof Error ? err.message : String(err);
        }
      }

      const attempt: Attempt = {
        provider, model, ok: once.ok, kind: once.kind, error: once.error?.slice(0, 300),
        durationMs: Date.now() - t0, sessionId: once.sessionId,
      };
      attempts.push(attempt);
      logCall({ ts: new Date().toISOString(), role: task.role, label: task.label ?? task.role, ...attempt, hitTurnLimit: once.hitTurnLimit });
      process.stderr.write(`[agent] ${task.label ?? task.role} → ${provider}/${model}: ${once.ok ? 'ok' : `${once.kind}: ${once.error?.slice(0, 160)}`} (${Math.round(attempt.durationMs / 1000)}s)\n`);

      if (once.ok) {
        return {
          ok: true, provider, model, data, text: once.text, sessionId: once.sessionId,
          hitTurnLimit: once.hitTurnLimit, durationMs: Date.now() - started, attempts,
        };
      }
      if (once.kind === 'invalid_output' && round === 0) {
        prompt = `${task.prompt}\n\nYour previous answer was rejected: ${once.error}. Answer again with output that matches the required JSON schema exactly.`;
        continue;
      }
      break;
    }
  }

  const last = attempts[attempts.length - 1];
  return { ok: false, durationMs: Date.now() - started, attempts, error: last ? `${last.provider}: ${last.kind}: ${last.error}` : 'no provider configured' };
}

/** Check each provider can answer. Used by the runner preflight and the weekly login check. */
export async function probeProviders(providers: Provider[] = ['claude', 'codex']): Promise<Record<Provider, Attempt>> {
  const results = {} as Record<Provider, Attempt>;
  await Promise.all(providers.map(async p => {
    const r = await runAgent({ role: 'probe', label: `probe:${p}`, providers: [p], prompt: 'Reply with exactly: AUTHOK', cwd: os.tmpdir() });
    const a = r.attempts[r.attempts.length - 1];
    const ok = r.ok && /AUTHOK/.test(r.text ?? '');
    results[p] = { ...a, ok, kind: ok ? undefined : a?.kind ?? 'error' };
  }));
  return results;
}
