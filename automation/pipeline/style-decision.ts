/**
 * Pure decision logic for picking next month's design style: types, the novelty filter and the
 * weighted rubric. No I/O here — ideation.ts gathers history, candidates and scores, and this
 * module decides. Unit-tested in style-decision.test.ts.
 */

export const FAMILIES = ['contemporary', 'pre-modern', 'modern-movement', 'regional', 'medium', 'digital-subculture'] as const;
export const LAYOUTS = ['single-column', 'grid', 'magazine', 'scroll-narrative', 'document', 'dashboard', 'collage', 'index'] as const;
export const TYPE_CLASSES = ['serif', 'sans', 'mono', 'display', 'blackletter', 'script', 'mixed'] as const;
export const PALETTES = ['mono', 'duotone', 'limited', 'polychrome'] as const;
export const DENSITIES = ['sparse', 'balanced', 'dense'] as const;

export interface Fingerprint {
  family: (typeof FAMILIES)[number];
  era: string;
  layoutArchetype: (typeof LAYOUTS)[number];
  typeClass: (typeof TYPE_CLASSES)[number];
  palette: (typeof PALETTES)[number];
  density: (typeof DENSITIES)[number];
}

export interface Edition {
  month: string;
  trend: string;
  description: string;
  fingerprint?: Fingerprint;
}

export interface Candidate {
  id: string;
  name: string;
  summary: string;
  structure: string;
  typography: string;
  color: string;
  spacing: string;
  interactions: string;
  motifs: string;
  references: { title: string; url: string }[];
  blogFitNotes: string;
  culturalNotes: string;
  fingerprint: Fingerprint;
  lens?: string;
}

export const CRITERIA = ['novelty', 'identity', 'readability', 'feasibility', 'accessibilityRisk', 'culturalRespect'] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Scores = Record<Criterion, number>;

/** Weights of the rubric. accessibilityRisk is scored 10 = low risk. */
export const WEIGHTS: Scores = {
  novelty: 0.25,
  identity: 0.2,
  readability: 0.2,
  feasibility: 0.15,
  accessibilityRisk: 0.1,
  culturalRespect: 0.1,
};

/** Hard limits: a candidate below any of these is dropped whatever its total. */
export const MIN = { novelty: 5, culturalRespect: 6, readability: 5 };
/** The winner must reach this weighted total, or the run falls back to the style registry. */
export const MIN_TOTAL = 6;

// ---------- JSON Schemas for typed agent output ----------

const fingerprintSchema = {
  type: 'object',
  properties: {
    family: { type: 'string', enum: [...FAMILIES] },
    era: { type: 'string', description: 'Period and place, e.g. "15th-century Venice" or "1990s web".' },
    layoutArchetype: { type: 'string', enum: [...LAYOUTS] },
    typeClass: { type: 'string', enum: [...TYPE_CLASSES] },
    palette: { type: 'string', enum: [...PALETTES] },
    density: { type: 'string', enum: [...DENSITIES] },
  },
  required: ['family', 'era', 'layoutArchetype', 'typeClass', 'palette', 'density'],
  additionalProperties: false,
};

export const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kebab-case' },
          name: { type: 'string' },
          summary: { type: 'string', description: '2-3 sentences: what the style is and why it suits this blog.' },
          structure: { type: 'string', description: 'Page architecture, grid, homepage skeleton, navigation.' },
          typography: { type: 'string', description: 'Typefaces (Google Fonts where possible), scale, treatment.' },
          color: { type: 'string', description: 'Palette with hex values and the role of each colour.' },
          spacing: { type: 'string' },
          interactions: { type: 'string', description: 'Hover, motion and one signature interactive detail.' },
          motifs: { type: 'string', description: 'Ornament, imagery treatment, signature visual elements.' },
          references: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, url: { type: 'string' } },
              required: ['title', 'url'],
              additionalProperties: false,
            },
          },
          blogFitNotes: { type: 'string', description: 'How long-form posts stay readable in this style.' },
          culturalNotes: { type: 'string', description: 'Sacred symbols, caricature risks, and how to avoid them. "none" if not applicable.' },
          fingerprint: fingerprintSchema,
        },
        required: ['id', 'name', 'summary', 'structure', 'typography', 'color', 'spacing', 'interactions', 'motifs', 'references', 'blogFitNotes', 'culturalNotes', 'fingerprint'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
};

export const FINGERPRINTS_SCHEMA = {
  type: 'object',
  properties: {
    editions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { month: { type: 'string' }, fingerprint: fingerprintSchema },
        required: ['month', 'fingerprint'],
        additionalProperties: false,
      },
    },
  },
  required: ['editions'],
  additionalProperties: false,
};

// Ranges are checked in validateScores; strict structured output may reject minimum/maximum.
const score = { type: 'number', description: '0 to 10' };
export const SCORES_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidateId: { type: 'string' },
          novelty: score,
          identity: score,
          readability: score,
          feasibility: score,
          accessibilityRisk: { type: 'number', description: '0 to 10; 10 = low accessibility risk' },
          culturalRespect: score,
          rationale: { type: 'string' },
        },
        required: ['candidateId', ...CRITERIA, 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['scores'],
  additionalProperties: false,
};

// ---------- validation of agent output ----------

function isFingerprint(f: any): f is Fingerprint {
  return !!f && FAMILIES.includes(f.family) && LAYOUTS.includes(f.layoutArchetype) && TYPE_CLASSES.includes(f.typeClass)
    && PALETTES.includes(f.palette) && DENSITIES.includes(f.density) && typeof f.era === 'string';
}

export function validateCandidates(value: unknown): { candidates: Candidate[] } {
  const list = (value as any)?.candidates;
  if (!Array.isArray(list) || list.length === 0) throw new Error('candidates must be a non-empty array');
  for (const c of list) {
    for (const k of ['id', 'name', 'summary', 'structure', 'typography', 'color']) {
      if (typeof c?.[k] !== 'string' || !c[k].trim()) throw new Error(`candidate.${k} is missing`);
    }
    if (!isFingerprint(c.fingerprint)) throw new Error(`candidate ${c.id} has an invalid fingerprint`);
    if (!Array.isArray(c.references) || c.references.length < 2) throw new Error(`candidate ${c.id} needs 2+ references`);
  }
  return { candidates: list };
}

export interface JudgeScore extends Scores {
  candidateId: string;
  rationale: string;
}

export function validateScores(ids: string[]) {
  return (value: unknown): { scores: JudgeScore[] } => {
    const list = (value as any)?.scores;
    if (!Array.isArray(list)) throw new Error('scores must be an array');
    for (const id of ids) {
      const s = list.find((x: any) => x?.candidateId === id);
      if (!s) throw new Error(`no score for candidate ${id}`);
      for (const c of CRITERIA) {
        if (typeof s[c] !== 'number' || s[c] < 0 || s[c] > 10) throw new Error(`score ${c} for ${id} must be 0-10`);
      }
    }
    return { scores: list };
  };
}

// ---------- novelty filter ----------

const STOP = new Set(['design', 'style', 'styles', 'modern', 'classic', 'contemporary', 'revival', 'international', 'layout', 'web']);
export const sigWords = (s: string): string[] =>
  s.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5 && !STOP.has(w));

const FP_FIELDS: (keyof Fingerprint)[] = ['family', 'layoutArchetype', 'typeClass', 'palette', 'density'];
export const sharedFields = (a: Fingerprint, b: Fingerprint): number => FP_FIELDS.filter(k => a[k] === b[k]).length;

export interface FilterResult {
  kept: Candidate[];
  dropped: { id: string; name: string; reason: string }[];
}

/**
 * Drop repeats in code, before any scoring:
 *  - name shares a significant word with a past edition or an avoided style
 *  - same family AND same layout archetype as any of the last 6 editions
 *  - 4+ of 5 fingerprint fields equal to last month's edition
 *  - duplicate of an earlier candidate (same id or name words)
 */
export function noveltyFilter(candidates: Candidate[], history: Edition[], avoid: string[], max = 6): FilterResult {
  const recent = [...history].sort((a, b) => b.month.localeCompare(a.month));
  const last6 = recent.slice(0, 6);
  const last = recent[0];
  const pastWords = new Set([...history.map(h => h.trend), ...avoid].flatMap(sigWords));
  const kept: Candidate[] = [];
  const dropped: FilterResult['dropped'] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const words = sigWords(c.name);
    const clash = words.find(w => pastWords.has(w));
    const twin = last6.find(h => h.fingerprint && h.fingerprint.family === c.fingerprint.family && h.fingerprint.layoutArchetype === c.fingerprint.layoutArchetype);
    const key = c.id.toLowerCase();
    let reason = '';
    if (clash) reason = `name shares "${clash}" with a past or avoided style`;
    else if (twin) reason = `same family (${c.fingerprint.family}) and layout (${c.fingerprint.layoutArchetype}) as ${twin.month} ${twin.trend}`;
    else if (last?.fingerprint && sharedFields(c.fingerprint, last.fingerprint) >= 4) reason = `4+ fingerprint fields equal to last month (${last.trend})`;
    else if (seen.has(key) || words.some(w => seen.has(`w:${w}`))) reason = 'duplicate of another candidate';
    if (reason) {
      dropped.push({ id: c.id, name: c.name, reason });
      continue;
    }
    seen.add(key);
    words.forEach(w => seen.add(`w:${w}`));
    kept.push(c);
  }
  // Fill the shortlist round-robin across lenses, so the lens whose researcher answered
  // last is not cut by arrival order.
  const lenses = [...new Set(kept.map(c => c.lens ?? ''))];
  const queues = lenses.map(l => kept.filter(c => (c.lens ?? '') === l));
  const fair: Candidate[] = [];
  while (fair.length < kept.length) for (const q of queues) if (q.length) fair.push(q.shift()!);
  for (const c of fair.slice(max)) dropped.push({ id: c.id, name: c.name, reason: `over the shortlist cap of ${max}` });
  return { kept: fair.slice(0, max), dropped };
}

// ---------- weighted decision ----------

export interface Ranked {
  id: string;
  name: string;
  scores: Scores;
  total: number;
  judges: number;
  deciderNovelty?: number;
  rejected?: string;
}

/**
 * Share of the decider's novelty reading in the blended novelty. The 4B decider reads novelty
 * about 4 points lower than the judges for every candidate (measured 2026-10-03), so it only
 * nudges the ranking; the judges dominate.
 */
export const DECIDER_NOVELTY_WEIGHT = 0.25;

/**
 * Combine judge scores (mean per criterion) with the local decider's novelty reading, apply the
 * hard limits, and rank by weighted total. Ties go to the more novel candidate.
 */
export function rank(
  candidates: Candidate[],
  judgeRuns: JudgeScore[][],
  deciderNovelty: Record<string, number | undefined> = {},
): Ranked[] {
  const out: Ranked[] = candidates.map(c => {
    const mine = judgeRuns.map(run => run.find(s => s.candidateId === c.id)).filter(Boolean) as JudgeScore[];
    const scores = Object.fromEntries(
      CRITERIA.map(k => [k, mine.length ? mine.reduce((sum, s) => sum + s[k], 0) / mine.length : 0]),
    ) as Scores;
    const dn = deciderNovelty[c.id];
    if (dn !== undefined && mine.length) scores.novelty = (1 - DECIDER_NOVELTY_WEIGHT) * scores.novelty + DECIDER_NOVELTY_WEIGHT * dn;
    const total = CRITERIA.reduce((sum, k) => sum + WEIGHTS[k] * scores[k], 0);
    let rejected: string | undefined;
    if (!mine.length) rejected = 'no judge scored it';
    else if (scores.novelty < MIN.novelty) rejected = `novelty ${scores.novelty.toFixed(1)} < ${MIN.novelty}`;
    else if (scores.culturalRespect < MIN.culturalRespect) rejected = `cultural respect ${scores.culturalRespect.toFixed(1)} < ${MIN.culturalRespect}`;
    else if (scores.readability < MIN.readability) rejected = `readability ${scores.readability.toFixed(1)} < ${MIN.readability}`;
    return { id: c.id, name: c.name, scores, total: +total.toFixed(2), judges: mine.length, deciderNovelty: dn, rejected };
  });
  return out.sort((a, b) => {
    if (!!a.rejected !== !!b.rejected) return a.rejected ? 1 : -1;
    return b.total - a.total || b.scores.novelty - a.scores.novelty;
  });
}

/** The winner, or null when nobody passes the hard limits and MIN_TOTAL. */
export function pickWinner(ranked: Ranked[]): Ranked | null {
  const top = ranked[0];
  return top && !top.rejected && top.total >= MIN_TOTAL ? top : null;
}

/**
 * Turn the decider's typed answers into a 0–10 novelty value: the probability that the
 * candidate is close to no past edition, blended with its novelty score (levels 0..4).
 */
export function deciderNoveltyFrom(answers: any): number | undefined {
  const pNone = answers?.closest?.probabilities?.none;
  const level = answers?.novelty?.score;
  const parts: number[] = [];
  if (typeof pNone === 'number') parts.push(pNone * 10);
  if (typeof level === 'number') parts.push((level / 4) * 10);
  return parts.length ? +(parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2) : undefined;
}
