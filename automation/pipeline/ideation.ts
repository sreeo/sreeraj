/**
 * Ideation: research, evaluate and decide next month's design style.
 *
 *   npx tsx pipeline/ideation.ts        # trend line on stdout, progress on stderr
 *
 * 1. History  — past editions from public/archive/registry.json plus the live manifest, each with
 *               a style fingerprint (cached in history/fingerprints.json).
 * 2. Feedback — n8n's PR review learner: styles to avoid and lessons for the implementer.
 * 3. Research — three researcher agents with web search, one lens each, 3 candidates each.
 * 4. Filter   — code drops repeats of past or avoided styles (style-decision.ts).
 * 5. Novelty  — the local CPU decider (n8n /webhook/decide) reads how close each candidate is to
 *               the archive.
 * 6. Judges   — two judges on different providers score the shortlist on a fixed rubric.
 * 7. Decide   — code ranks by weighted total with hard limits; no winner → style registry.
 *
 * Same contract as pick-trend.ts: prints "Name — description", writes history/current-trend.json
 * (structure/typography/spacing/interactions/references + color/motifs/lessons/fingerprint), and
 * always exits 0 with a usable line. The full record goes to test-output/decision.json and a
 * reviewer summary to test-output/decision-summary.md.
 */
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { selectTrend, type DesignLog } from '../trend-registry.js';
import { runAgent, type Provider } from './agent.js';
import {
  CANDIDATES_SCHEMA, FINGERPRINTS_SCHEMA, MIN_TOTAL, SCORES_SCHEMA, WEIGHTS, deciderNoveltyFrom, noveltyFilter,
  pickWinner, rank, validateCandidates, validateScores,
  type Candidate, type Edition, type Fingerprint, type JudgeScore, type Ranked,
} from './style-decision.js';

const N8N = process.env.N8N_URL ?? 'http://127.0.0.1:5678';
const N8N_HEADERS: Record<string, string> = process.env.N8N_WEBHOOK_TOKEN ? { 'x-redesign-token': process.env.N8N_WEBHOOK_TOKEN } : {};
const ROOT = CONFIG.projectRoot;
const HISTORY_DIR = path.join(ROOT, 'automation/history');
const FP_CACHE = path.join(HISTORY_DIR, 'fingerprints.json');
const log = (msg: string) => process.stderr.write(`ideation: ${msg}\n`);

const LENSES: { key: string; brief: string }[] = [
  {
    key: 'cutting-edge',
    brief: 'current, distinctive web design from the last six months: award winners and experiments (Awwwards, CSS Design Awards, siteinspire, Godly, Hoverstat.es). Favour the strange and specific over tasteful SaaS minimalism.',
  },
  {
    key: 'pre-modern',
    brief: 'ancient, medieval, Renaissance and early-modern visual traditions from any culture: inscriptions, manuscripts, early printing, maps, heraldry, scientific plates, temple and palace ornament systems.',
  },
  {
    key: 'niche',
    brief: 'regional design traditions and non-web media translated to the web: transit and wayfinding systems, packaging, field guides, instrument panels, sheet music, stamps, defunct digital platforms and subcultures.',
  },
];

// ---------- 1. history ----------

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function loadEditions(): Edition[] {
  const registry = readJson<{ archives?: any[] }>(path.join(ROOT, 'public/archive/registry.json'), {});
  const manifest = readJson<any>(path.join(ROOT, 'src/data/design-manifest.json'), {});
  const editions: Edition[] = (registry.archives ?? []).map(a => ({
    month: a.month, trend: a.trend, description: a.description ?? '', fingerprint: a.fingerprint,
  }));
  if (manifest?.month && manifest?.trend && !editions.some(e => e.month === manifest.month)) {
    editions.push({ month: manifest.month, trend: manifest.trend, description: manifest.description ?? '', fingerprint: manifest.fingerprint });
  }
  return editions.sort((a, b) => b.month.localeCompare(a.month));
}

async function withFingerprints(editions: Edition[]): Promise<Edition[]> {
  const cache = readJson<Record<string, Fingerprint>>(FP_CACHE, {});
  const missing = editions.filter(e => !e.fingerprint && !cache[e.month]);
  if (missing.length) {
    log(`fingerprinting ${missing.length} past edition(s)`);
    const r = await runAgent<{ editions: { month: string; fingerprint: Fingerprint }[] }>({
      role: 'judge',
      label: 'fingerprint-history',
      schema: FINGERPRINTS_SCHEMA,
      prompt: `Classify each past edition of a personal tech blog's monthly redesign by its visual style. Return one fingerprint per edition, using the month as the key.\n\n${missing.map(e => `- ${e.month}: ${e.trend} — ${e.description}`).join('\n')}`,
    });
    for (const f of r.data?.editions ?? []) cache[f.month] = f.fingerprint;
    if (r.ok) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
      fs.writeFileSync(FP_CACHE, JSON.stringify(cache, null, 2) + '\n');
    }
  }
  return editions.map(e => ({ ...e, fingerprint: e.fingerprint ?? cache[e.month] }));
}

// ---------- 2. feedback from n8n ----------

interface Feedback {
  available: boolean;
  avoid: { style: string; reason: string; pr: number; evidence?: string }[];
  lessons: { reason: string; pr: number; style: string; evidence?: string }[];
}

async function loadFeedback(): Promise<Feedback> {
  try {
    // Classify any PR closed since the learner's last hourly run, then read the result.
    await fetch(`${N8N}/webhook/redesign-reviews/sync`, { method: 'POST', headers: N8N_HEADERS, signal: AbortSignal.timeout(15 * 60_000) }).catch(() => undefined);
    const res = await fetch(`${N8N}/webhook/redesign-feedback`, { headers: N8N_HEADERS, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: any = await res.json();
    return { available: true, avoid: body.avoid_styles ?? [], lessons: body.lessons ?? [] };
  } catch (err) {
    log(`n8n feedback unavailable (${err instanceof Error ? err.message : err}); continuing without it`);
    return { available: false, avoid: [], lessons: [] };
  }
}

// ---------- 3. research ----------

const SITE = `sreeraj.dev is a personal tech blog (DevOps, programming, Postgres) with trekking trip reports. It is an Astro 5 static site with about 20 long-form posts, tag pages, an archive of past monthly designs, and About/Contact pages. Every month it is rebuilt in a completely different visual idiom. Readers expect a genuine surprise, but posts must stay comfortable to read.`;

function researchPrompt(lens: (typeof LENSES)[number], history: Edition[], fb: Feedback): string {
  const past = history.map(e => `- ${e.month}: ${e.trend}${e.fingerprint ? ` [${e.fingerprint.family}, ${e.fingerprint.layoutArchetype}, ${e.fingerprint.typeClass}, ${e.fingerprint.palette}]` : ''}`).join('\n');
  const avoid = fb.avoid.map(a => `- ${a.style} (PR #${a.pr}: ${a.reason})`).join('\n');
  return `${SITE}

You are a design researcher. Your lens this month: **${lens.brief}**

Use web search to find real, specific sources. Then propose exactly 3 distinct design styles from this lens for next month's redesign.

Each style needs:
- a strong, nameable identity: a movement, period, tradition, medium or subculture, not a generic mood;
- a structural idea for the homepage and post pages, not just colours;
- typefaces available on Google Fonts where possible;
- at least 2 real reference URLs you found with search;
- honest notes on readability and on cultural sensitivity (sacred symbols, caricature).

Past editions. Do not propose these or close variants:
${past || '- none'}
${avoid ? `\nStyles the site owner rejected in PR reviews. Do not propose these or close variants:\n${avoid}\n` : ''}
Fill the fingerprint honestly; code uses it to reject repeats.`;
}

async function research(history: Edition[], fb: Feedback): Promise<{ candidates: Candidate[]; failures: string[] }> {
  const results = await Promise.all(LENSES.map(lens => runAgent<{ candidates: Candidate[] }>({
    role: 'researcher',
    label: `researcher:${lens.key}`,
    schema: CANDIDATES_SCHEMA,
    validate: validateCandidates,
    prompt: researchPrompt(lens, history, fb),
  }).then(r => ({ lens, r }))));
  const candidates: Candidate[] = [];
  const failures: string[] = [];
  for (const { lens, r } of results) {
    if (r.ok && r.data) candidates.push(...r.data.candidates.map(c => ({ ...c, lens: lens.key })));
    else failures.push(`${lens.key}: ${r.error}`);
  }
  return { candidates, failures };
}

// ---------- 5. local decider novelty ----------

async function deciderNovelty(candidates: Candidate[], history: Edition[]): Promise<Record<string, number | undefined>> {
  if (process.env.REDESIGN_DECIDER === 'off') return {};
  const out: Record<string, number | undefined> = {};
  const editions = Object.fromEntries(history.slice(0, 8).map(e => [e.month, `${e.trend}: ${e.description}`.slice(0, 220)]));
  for (const c of candidates) {
    try {
      const res = await fetch(`${N8N}/webhook/decide`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-requested-by': 'ideation', ...N8N_HEADERS },
        signal: AbortSignal.timeout(5 * 60_000),
        body: JSON.stringify({
          state: { candidate: `${c.name}: ${c.summary}`.slice(0, 500), editions },
          questions: {
            closest: {
              type: 'choice',
              instructions: 'Which past edition is the candidate style closest to? Pick none if no edition shares its layout and typography.',
              criteria: { ...Object.fromEntries(Object.keys(editions).map(m => [m, `Edition ${m}`])), none: 'No past edition is close' },
            },
            novelty: {
              type: 'score',
              instructions: 'How novel is the candidate compared with all past editions?',
              criteria: ['near copy', 'same family', 'some overlap', 'clearly different', 'entirely new territory'],
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      out[c.id] = deciderNoveltyFrom((await res.json() as any).answers);
      log(`decider novelty ${c.id}: ${out[c.id]}`);
    } catch (err) {
      log(`decider unavailable for ${c.id} (${err instanceof Error ? err.message : err}); judges decide alone`);
      break;
    }
  }
  return out;
}

// ---------- 6. judges ----------

function judgePrompt(candidates: Candidate[], history: Edition[], fb: Feedback): string {
  return `${SITE}

Score each candidate style for next month's redesign, from 0 to 10 on each criterion:
- novelty: how different it is from every past edition below (10 = entirely new territory);
- identity: how strong and nameable the idiom is (10 = unmistakable);
- readability: how well long-form posts can stay comfortable to read in it;
- feasibility: how well it can be built well in one pass with Astro, CSS and Google Fonts, without image assets;
- accessibilityRisk: 10 = low risk (contrast, motion, legibility are easy to get right);
- culturalRespect: 10 = no risk of caricature or misuse of sacred or living traditions.

Past editions:
${history.map(e => `- ${e.month}: ${e.trend}`).join('\n')}
${fb.avoid.length ? `\nRejected by the site owner: ${fb.avoid.map(a => a.style).join(', ')}\n` : ''}
Candidates (score every one, keyed by candidateId):
${candidates.map(c => `\n### ${c.id} — ${c.name} (lens: ${c.lens})\n${c.summary}\nStructure: ${c.structure}\nTypography: ${c.typography}\nColour: ${c.color}\nReadability notes: ${c.blogFitNotes}\nCultural notes: ${c.culturalNotes}`).join('\n')}`;
}

async function judge(candidates: Candidate[], history: Edition[], fb: Feedback): Promise<{ runs: JudgeScore[][]; meta: { provider?: string; model?: string; ok: boolean; error?: string }[] }> {
  const ids = candidates.map(c => c.id);
  const prompt = judgePrompt(candidates, history, fb);
  // Two judges on different providers; either one alone is enough to decide.
  const panels: Provider[][] = [['claude'], ['codex']];
  const results = await Promise.all(panels.map((providers, i) => runAgent<{ scores: JudgeScore[] }>({
    role: 'judge', label: `judge:${i + 1}`, providers, schema: SCORES_SCHEMA, validate: validateScores(ids), prompt,
  })));
  return {
    runs: results.filter(r => r.ok && r.data).map(r => r.data!.scores),
    meta: results.map(r => ({ provider: r.provider, model: r.model, ok: r.ok, error: r.error })),
  };
}

// ---------- outputs ----------

function specFor(c: Candidate, fb: Feedback) {
  const lessons = fb.lessons.map(l => `- From PR #${l.pr} (${l.style}, ${l.reason}): ${(l.evidence ?? '').replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  return {
    id: c.id,
    name: c.name,
    description: c.summary,
    structure: c.structure,
    typography: c.typography,
    color: c.color,
    spacing: c.spacing,
    interactions: c.interactions,
    motifs: c.motifs,
    references: c.references.map(r => `${r.title} (${r.url})`).join('; '),
    lessons: lessons ? `Past reviews flagged these problems. Avoid them whatever the style:\n${lessons}` : undefined,
    fingerprint: c.fingerprint,
    source: 'research',
  };
}

function summaryMarkdown(winner: Candidate | null, ranked: Ranked[], dropped: { name: string; reason: string }[], judges: any[], fb: Feedback, fallback?: string): string {
  const lines = ['### Style decision', ''];
  if (winner) lines.push(`**Chosen:** ${winner.name} (${winner.lens} lens) — ${winner.summary}`, '');
  if (fallback) lines.push(`**Fallback:** ${fallback}`, '');
  if (ranked.length) {
    lines.push('| Candidate | Total | Novelty | Identity | Readability | Feasibility | Access. | Culture | Note |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of ranked) {
      const s = r.scores;
      lines.push(`| ${r.name} | ${r.total} | ${s.novelty.toFixed(1)} | ${s.identity.toFixed(1)} | ${s.readability.toFixed(1)} | ${s.feasibility.toFixed(1)} | ${s.accessibilityRisk.toFixed(1)} | ${s.culturalRespect.toFixed(1)} | ${r.rejected ?? ''} |`);
    }
    lines.push('', `Weights: ${Object.entries(WEIGHTS).map(([k, w]) => `${k} ${w}`).join(', ')}. Winner needs ≥ ${MIN_TOTAL}.`);
  }
  if (dropped.length) lines.push('', '<details><summary>Dropped before scoring</summary>', '', ...dropped.map(d => `- ${d.name}: ${d.reason}`), '', '</details>');
  lines.push('', `Judges: ${judges.map(j => j.ok ? `${j.provider}/${j.model}` : `failed (${(j.error ?? '').slice(0, 60)})`).join(', ') || 'none'}. PR-review feedback: ${fb.available ? `${fb.avoid.length} avoided style(s), ${fb.lessons.length} lesson(s)` : 'unavailable'}.`);
  return lines.join('\n');
}

function emit(trend: Record<string, any>, decision: Record<string, any>, summary: string): never {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.writeFileSync(path.join(HISTORY_DIR, 'current-trend.json'), JSON.stringify({ mode: 'research', pickedAt: new Date().toISOString(), ...trend }, null, 2) + '\n');
  fs.mkdirSync(CONFIG.testOutputDir, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'decision.json'), JSON.stringify(decision, null, 2) + '\n');
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'decision-summary.md'), summary + '\n');
  process.stdout.write(`${trend.name} — ${trend.description}\n`);
  process.exit(0);
}

function registryFallback(history: Edition[], reason: string, partial: Record<string, any>, fb: Feedback): never {
  log(`falling back to the style registry: ${reason}`);
  const designLog: DesignLog = {
    designs: history.map(e => ({ month: e.month, trendId: e.trend.toLowerCase().replace(/[^a-z0-9]+/g, '-'), trendName: e.trend, status: 'success' as const, timestamp: `${e.month}-01T00:00:00Z` })),
  };
  const t = selectTrend(designLog);
  const summary = summaryMarkdown(null, partial.ranked ?? [], partial.dropped ?? [], partial.judges ?? [], fb, `${t.name} from the style registry — ${reason}`);
  emit({ ...t, source: 'registry' }, { ...partial, fallback: { reason, trend: t } }, summary);
}

// ---------- main ----------

async function main(): Promise<void> {
  const started = new Date().toISOString();
  const history = await withFingerprints(loadEditions());
  log(`history: ${history.map(e => `${e.month} ${e.trend}`).join(' | ')}`);
  const fb = await loadFeedback();
  log(`feedback: ${fb.avoid.length} avoided, ${fb.lessons.length} lesson(s)`);

  const { candidates, failures } = await research(history, fb);
  log(`research: ${candidates.length} candidate(s)${failures.length ? `; failed: ${failures.join(' | ')}` : ''}`);
  const base = { started, history, feedback: fb, researchFailures: failures, candidates };
  if (!candidates.length) registryFallback(history, 'no researcher returned candidates', base, fb);

  const { kept, dropped } = noveltyFilter(candidates, history, fb.avoid.map(a => a.style));
  log(`filter: kept ${kept.length}, dropped ${dropped.length}`);
  if (!kept.length) registryFallback(history, 'every candidate repeated a past or avoided style', { ...base, dropped }, fb);

  const novelty = await deciderNovelty(kept, history);
  const { runs, meta } = await judge(kept, history, fb);
  if (!runs.length) registryFallback(history, 'no judge produced valid scores', { ...base, dropped, deciderNovelty: novelty, judges: meta }, fb);

  const ranked = rank(kept, runs, novelty);
  const top = pickWinner(ranked);
  const decision = { ...base, dropped, deciderNovelty: novelty, judges: meta, judgeScores: runs, ranked, weights: WEIGHTS, winner: top?.id ?? null, finished: new Date().toISOString() };
  if (!top) registryFallback(history, `no candidate reached ${MIN_TOTAL} within the hard limits`, decision, fb);

  const winner = kept.find(c => c.id === top!.id)!;
  log(`winner: ${winner.name} (${top!.total})`);
  emit(specFor(winner, fb), decision, summaryMarkdown(winner, ranked, dropped, meta, fb));
}

main().catch(err => {
  log(`unexpected error: ${err instanceof Error ? err.stack : err}`);
  try {
    registryFallback(loadEditions(), 'ideation crashed', { error: String(err) }, { available: false, avoid: [], lessons: [] });
  } catch {
    process.stdout.write('Editorial Minimalism — restrained type-driven layout, generous whitespace, a single accent, clear hierarchy\n');
    process.exit(0);
  }
});
