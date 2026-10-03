/**
 * Check that each agent provider can answer on this host.
 *
 *   npx tsx pipeline/probe.ts            # human-readable lines on stderr, JSON on stdout
 *
 * Exit 0 when at least one provider works (the run can proceed on it), 4 when none does.
 * Used by the runner's preflight and by the weekly login check.
 */
import { probeProviders, type Provider } from './agent.js';

const providers = (process.env.PROBE_PROVIDERS?.split(',').filter(Boolean) as Provider[] | undefined) ?? ['claude', 'codex'];
const results = await probeProviders(providers);

for (const [provider, r] of Object.entries(results)) {
  process.stderr.write(`probe ${provider} (${r.model}): ${r.ok ? 'OK' : `FAIL ${r.kind}: ${r.error ?? ''}`}\n`);
}
process.stdout.write(JSON.stringify(results) + '\n');
process.exit(Object.values(results).some(r => r.ok) ? 0 : 4);
