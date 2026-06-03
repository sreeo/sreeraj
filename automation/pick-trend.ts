/**
 * Pick this month's design trend and print it as "Name — description" on stdout.
 *
 * A real script file (not `tsx -e`) so relative imports resolve reliably.
 * Web-search discovery is best-effort and BOUNDED: if it doesn't finish within
 * the timeout (or throws), we fall back to the curated registry — the monthly
 * run must never hang here. All progress noise goes to stderr; only the final
 * trend goes to stdout. Force-exits so a still-pending Agent SDK query can't
 * keep the process alive.
 */
import fs from 'fs';
import { discoverTrend } from './trend-discovery.js';
import { selectTrend } from './trend-registry.js';

const DISCOVERY_TIMEOUT_MS = Number(process.env.TREND_DISCOVERY_TIMEOUT_MS || 240_000);

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`discovery timed out after ${ms}ms`)), ms));
}

function emit(name: string, description: string): never {
  process.stdout.write(`${name} — ${description}\n`);
  process.exit(0);
}

async function main(): Promise<void> {
  let log: { designs?: { trendName: string }[] } = { designs: [] };
  try {
    log = JSON.parse(fs.readFileSync('history/design-log.json', 'utf-8'));
  } catch {
    /* no log yet */
  }
  const last = log.designs?.length ? log.designs[log.designs.length - 1].trendName : null;

  let trend: { name: string; description: string } | null = null;
  try {
    trend = await Promise.race([discoverTrend(log as any, last), timeout(DISCOVERY_TIMEOUT_MS)]);
  } catch (err) {
    console.error(`pick-trend: ${err instanceof Error ? err.message : err}; falling back to registry.`);
  }
  if (!trend || !trend.name) trend = selectTrend(log as any);

  emit(trend.name, trend.description);
}

main().catch(() => {
  const t = selectTrend({ designs: [] } as any);
  emit(t.name, t.description);
});
