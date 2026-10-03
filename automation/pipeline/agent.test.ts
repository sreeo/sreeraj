/**
 * Unit tests for the agent adapter. Fake `claude` and `codex` executables on PATH stand in for
 * the real CLIs, so fallback and repair logic run without calling a model.
 *
 *   npm run test:unit
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { classify, roleConfig, runAgent, strictSchema, withImages } from './agent.js';

const SCHEMA = {
  type: 'object',
  properties: { pick: { type: 'string' }, note: { type: 'string' } },
  required: ['pick'],
};

let bin: string;
let savedPath: string | undefined;
let savedProviders: string | undefined;

/** Write a fake CLI. `body` is a shell snippet; <bin>/<name>.calls gets one line per call. */
function fake(name: string, body: string): void {
  const file = path.join(bin, name);
  fs.writeFileSync(file, `#!/usr/bin/env bash\ncat >/dev/null\necho x >> "${bin}/${name}.calls"\n${body}\n`);
  fs.chmodSync(file, 0o755);
}
const calls = (name: string) =>
  fs.existsSync(path.join(bin, `${name}.calls`)) ? fs.readFileSync(path.join(bin, `${name}.calls`), 'utf-8').trim().split('\n').length : 0;

beforeEach(() => {
  bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-cli-'));
  savedPath = process.env.PATH;
  savedProviders = process.env.REDESIGN_PROVIDERS;
  process.env.PATH = `${bin}:${savedPath}`;
  delete process.env.REDESIGN_PROVIDERS;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
  process.env.REDESIGN_AGENT_LOG = path.join(bin, 'agent-calls.jsonl');
});

afterEach(() => {
  process.env.PATH = savedPath;
  if (savedProviders === undefined) delete process.env.REDESIGN_PROVIDERS;
  else process.env.REDESIGN_PROVIDERS = savedProviders;
  fs.rmSync(bin, { recursive: true, force: true });
});

describe('classify', () => {
  it('spots login failures', () => {
    assert.equal(classify('Failed to authenticate: OAuth session expired and could not be refreshed'), 'auth');
    assert.equal(classify('Error: 401 Unauthorized'), 'auth');
  });
  it('spots rate limits', () => {
    assert.equal(classify('You have hit your usage limit. Try again at 5pm'), 'rate_limit');
    assert.equal(classify('HTTP 429 Too Many Requests'), 'rate_limit');
  });
  it('falls back to error', () => assert.equal(classify('ENOENT: no such file'), 'error'));
});

describe('strictSchema', () => {
  it('makes every property required and forbids extra keys, recursively', () => {
    const out = strictSchema({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'object', properties: { c: { type: 'number' } } } },
      required: ['a'],
    }) as any;
    assert.deepEqual(out.required, ['a', 'b']);
    assert.equal(out.additionalProperties, false);
    assert.deepEqual(out.properties.b.required, ['c']);
    assert.equal(out.properties.b.additionalProperties, false);
  });
});

describe('withImages', () => {
  it('tells Claude to Read each image path', () => {
    const p = withImages('Judge this.', ['/tmp/a.png'], 'claude');
    assert.match(p, /Read tool/);
    assert.match(p, /\/tmp\/a\.png/);
  });
  it('lists attached images for Codex by file name', () => {
    const p = withImages('Judge this.', ['/tmp/a.png'], 'codex');
    assert.match(p, /attached image/);
    assert.doesNotMatch(p, /Read tool/);
  });
  it('leaves the prompt alone without images', () => assert.equal(withImages('x', [], 'claude'), 'x'));
});

describe('roleConfig', () => {
  it('reads the role and lets REDESIGN_PROVIDERS force the order', () => {
    assert.deepEqual(roleConfig('researcher').tools, ['web_search']);
    process.env.REDESIGN_PROVIDERS = 'codex';
    assert.deepEqual(roleConfig('researcher').providers, ['codex']);
  });
  it('rejects unknown roles', () => assert.throws(() => roleConfig('nope'), /unknown agent role/));
});

describe('runAgent', () => {
  it('returns Claude structured output', async () => {
    fake('claude', `echo '{"type":"result","subtype":"success","is_error":false,"result":"ok","structured_output":{"pick":"a"},"session_id":"s1"}'`);
    const r = await runAgent({ role: 'judge', prompt: 'pick', schema: SCHEMA, cwd: bin });
    assert.equal(r.ok, true);
    assert.equal(r.provider, 'claude');
    assert.deepEqual(r.data, { pick: 'a' });
    assert.equal(r.sessionId, 's1');
  });

  it('falls back to Codex when the Claude login has expired', async () => {
    fake('claude', `echo '{"type":"result","subtype":"success","is_error":true,"result":"Failed to authenticate: OAuth session expired"}'`);
    fake('codex', `out=""; while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done; echo '{"pick":"b","note":""}' > "$out"; echo "session id: 0199aaaa-bbbb-cccc-dddd-eeeeeeeeeeee" >&2`);
    const r = await runAgent({ role: 'judge', prompt: 'pick', schema: SCHEMA, cwd: bin });
    assert.equal(r.ok, true);
    assert.equal(r.provider, 'codex');
    assert.deepEqual(r.data, { pick: 'b', note: '' });
    assert.equal(r.attempts[0].kind, 'auth');
    assert.equal(r.sessionId, '0199aaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('asks once more when the answer fails validation, then succeeds', async () => {
    fake('claude', `if [ "$(wc -l < "${bin}/claude.calls")" -ge 2 ]; then
  echo '{"type":"result","is_error":false,"structured_output":{"pick":"good"}}'
else
  echo '{"type":"result","is_error":false,"structured_output":{"pick":"bad"}}'
fi`);
    const r = await runAgent({
      role: 'judge', prompt: 'pick', schema: SCHEMA, cwd: bin, providers: ['claude'],
      validate: v => {
        if ((v as any).pick !== 'good') throw new Error('pick must be good');
        return v as { pick: string };
      },
    });
    assert.equal(r.ok, true);
    assert.equal(calls('claude'), 2);
    assert.deepEqual(r.data, { pick: 'good' });
    assert.equal(r.attempts[0].kind, 'invalid_output');
  });

  it('reports failure when every provider fails, without throwing', async () => {
    fake('claude', `echo "You have hit your usage limit" >&2; exit 1`);
    fake('codex', `echo "401 Unauthorized" >&2; exit 1`);
    const r = await runAgent({ role: 'judge', prompt: 'pick', schema: SCHEMA, cwd: bin });
    assert.equal(r.ok, false);
    assert.deepEqual(r.attempts.map(a => a.kind), ['rate_limit', 'auth']);
  });

  it('treats a turn-limit stop as done work for edit roles', async () => {
    fake('claude', `echo '{"type":"result","subtype":"error_max_turns","is_error":true,"result":""}'`);
    const r = await runAgent({ role: 'implementer', prompt: 'build', cwd: bin, providers: ['claude'] });
    assert.equal(r.ok, true);
    assert.equal(r.hitTurnLimit, true);
  });
});
