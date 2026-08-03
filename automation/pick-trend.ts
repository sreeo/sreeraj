/**
 * Pick this month's design trend.
 *
 * Prints "Name — description" on stdout (the runner's $TREND / logs) and
 * writes the FULL trend spec to history/current-trend.json — structure,
 * typography, spacing, interactions, references — which the runner injects
 * into the rebuild prompt as {{TREND_SPEC}}. (Previously only the one-liner
 * survived; the rich spec was generated and then thrown away.)
 *
 * Creative range comes from a month-rotating territory so consecutive months
 * pull from different worlds:
 *   discover — web-search a fresh/niche idea (Agent SDK, bounded, fallback-safe)
 *   era      — historical movements (Art Nouveau, Constructivism, De Stijl…)
 *   medium   — non-web media translated (cartography, blueprints, zines, transit…)
 *   digital  — digital-native subcultures (teletext, demoscene, Y2K, cassette futurism…)
 *
 * All progress goes to stderr; only the trend line goes to stdout. Force-exits
 * so a pending Agent SDK query can't keep the process alive.
 */
import fs from 'fs';
import { discoverTrend } from './trend-discovery.js';
import { selectTrend, type TrendCategory, type DesignTrend } from './trend-registry.js';

const DISCOVERY_TIMEOUT_MS = Number(process.env.TREND_DISCOVERY_TIMEOUT_MS || 240_000);

const MODES = ['discover', 'era', 'medium', 'digital'] as const;
type Mode = (typeof MODES)[number];

// Research lenses for discover months — rotated so even the web-search months
// explore different territories instead of always chasing "current trends".
const LENSES = [
  'current cutting-edge web design (Awwwards, CSS Design Awards, siteinspire) — but favor the WEIRD winners, not tasteful SaaS minimalism',
  'a historical graphic-design movement or print era nobody has adapted to the web this year',
  'a niche NON-WEB medium translated to web design: sheet music, airline timetables, stamp albums, field guides, instrument panels, museum wall labels, trading cards, seed catalogs',
  'digital-native subcultures and defunct-platform aesthetics: WAP portals, MiniDisc packaging, winamp skins, TI calculator UIs, LAN-party culture, early web TV',
];

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`discovery timed out after ${ms}ms`)), ms),
  );
}

function emit(trend: Pick<DesignTrend, 'name' | 'description'> & Partial<DesignTrend>, mode: Mode): never {
  // Persist the full spec for the runner to inject into the rebuild prompt.
  try {
    fs.mkdirSync('history', { recursive: true });
    fs.writeFileSync(
      'history/current-trend.json',
      JSON.stringify({ mode, pickedAt: new Date().toISOString(), ...trend }, null, 2) + '\n',
    );
  } catch (e) {
    console.error(`pick-trend: could not write current-trend.json (${e instanceof Error ? e.message : e})`);
  }
  process.stdout.write(`${trend.name} — ${trend.description}\n`);
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

  const now = new Date();
  const monthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const mode: Mode = (process.env.REDESIGN_TREND_MODE as Mode) || MODES[monthIndex % MODES.length];
  console.error(`pick-trend: mode for this month = ${mode}`);

  if (mode === 'discover') {
    const lens = LENSES[Math.floor(monthIndex / MODES.length) % LENSES.length];
    console.error(`pick-trend: discovery lens = ${lens}`);
    try {
      const trend = await Promise.race([
        discoverTrend(log as any, last, lens),
        timeout(DISCOVERY_TIMEOUT_MS),
      ]);
      if (trend?.name) emit(trend, mode);
    } catch (err) {
      console.error(`pick-trend: ${err instanceof Error ? err.message : err}; falling back to registry.`);
    }
    // Discovery failed → still deliver variety: rotate the registry category.
    emit(selectTrend(log as any, MODES[(monthIndex + 1) % MODES.length] as TrendCategory), mode);
  }

  // Registry modes: era / medium / digital map directly to categories.
  emit(selectTrend(log as any, mode as TrendCategory), mode);
}

main().catch(() => {
  const t = selectTrend({ designs: [] } as any);
  emit(t, 'era');
});
