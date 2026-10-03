import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MIN_TOTAL, deciderNoveltyFrom, noveltyFilter, pickWinner, rank, sharedFields, sigWords, validateCandidates, validateScores,
  type Candidate, type Edition, type Fingerprint, type JudgeScore,
} from './style-decision.js';

const fp = (over: Partial<Fingerprint> = {}): Fingerprint => ({
  family: 'pre-modern', era: '15th c.', layoutArchetype: 'document', typeClass: 'serif', palette: 'limited', density: 'balanced', ...over,
});

const cand = (id: string, name: string, f: Partial<Fingerprint> = {}): Candidate => ({
  id, name, summary: 's', structure: 's', typography: 't', color: 'c', spacing: 's', interactions: 'i', motifs: 'm',
  references: [{ title: 'a', url: 'https://a' }, { title: 'b', url: 'https://b' }],
  blogFitNotes: 'b', culturalNotes: 'none', fingerprint: fp(f),
});

const HISTORY: Edition[] = [
  { month: '2026-10', trend: 'Russian Constructivism', description: '', fingerprint: fp({ family: 'modern-movement', layoutArchetype: 'collage', typeClass: 'display', palette: 'limited', density: 'dense' }) },
  { month: '2026-09', trend: 'De Stijl / Neoplasticism', description: '', fingerprint: fp({ family: 'modern-movement', layoutArchetype: 'grid', typeClass: 'sans', palette: 'polychrome' }) },
  { month: '2026-08', trend: 'Brutalist Web Design', description: '', fingerprint: fp({ family: 'digital-subculture', layoutArchetype: 'index', typeClass: 'mono', palette: 'mono' }) },
];

const scores = (id: string, v: Partial<JudgeScore> = {}): JudgeScore => ({
  candidateId: id, novelty: 8, identity: 8, readability: 8, feasibility: 8, accessibilityRisk: 8, culturalRespect: 8, rationale: '', ...v,
});

describe('sigWords / sharedFields', () => {
  it('keeps words of 5+ letters that are not stop words', () => assert.deepEqual(sigWords('De Stijl / Neoplasticism design'), ['stijl', 'neoplasticism']));
  it('counts equal fingerprint fields', () => assert.equal(sharedFields(fp(), fp({ palette: 'mono' })), 4));
});

describe('noveltyFilter', () => {
  it('drops a name that repeats a past edition', () => {
    const r = noveltyFilter([cand('c1', 'Constructivism Revisited', { family: 'regional' })], HISTORY, []);
    assert.equal(r.kept.length, 0);
    assert.match(r.dropped[0].reason, /constructivism/);
  });
  it('drops a style the owner rejected in a PR review', () => {
    const r = noveltyFilter([cand('c1', 'Neubrutalism Remix', { family: 'regional' })], HISTORY, ['Neubrutalism']);
    assert.match(r.dropped[0].reason, /neubrutalism/);
  });
  it('drops same family + layout as a recent edition', () => {
    const r = noveltyFilter([cand('c1', 'Bauhaus Grid', { family: 'modern-movement', layoutArchetype: 'grid' })], HISTORY, []);
    assert.match(r.dropped[0].reason, /same family/);
  });
  it('drops near-twins of last month by fingerprint', () => {
    const r = noveltyFilter([cand('c1', 'Agitprop Posters', { family: 'regional', layoutArchetype: 'collage', typeClass: 'display', palette: 'limited', density: 'dense' })], HISTORY, []);
    assert.match(r.dropped[0].reason, /4\+ fingerprint fields/);
  });
  it('drops duplicates and caps the shortlist', () => {
    const many = [cand('a', 'Illuminated Manuscript'), cand('a2', 'Manuscript Margins'), ...['b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => cand(id, `Style ${id}${id}${id}${id}${id}`, { family: 'regional' }))];
    const r = noveltyFilter(many, HISTORY, [], 6);
    assert.equal(r.kept.length, 6);
    assert.ok(r.dropped.some(d => d.reason === 'duplicate of another candidate'));
    assert.ok(r.dropped.some(d => /shortlist cap/.test(d.reason)));
  });
  it('fills the shortlist round-robin across lenses', () => {
    // Unique names per candidate, so only the cap (not the duplicate rule) trims the list.
    const mk = (lens: string, n: number) => Array.from({ length: n }, (_, i) => ({ ...cand(`${lens}${i}`, `${lens}${'qwe'[i].repeat(5)}`), lens }));
    const r = noveltyFilter([...mk('aaaaa', 3), ...mk('bbbbb', 3), ...mk('ccccc', 3)], [], [], 6);
    const byLens = r.kept.reduce((m, c) => ({ ...m, [c.lens!]: (m[c.lens!] ?? 0) + 1 }), {} as Record<string, number>);
    assert.deepEqual(byLens, { aaaaa: 2, bbbbb: 2, ccccc: 2 });
  });
  it('keeps a genuinely new style', () => {
    const r = noveltyFilter([cand('c1', 'Illuminated Manuscript')], HISTORY, []);
    assert.equal(r.kept.length, 1);
  });
});

describe('rank / pickWinner', () => {
  const cs = [cand('a', 'Alpha'), cand('b', 'Bravo'), cand('c', 'Charlie')];
  it('averages judges, ranks by weighted total and picks the top', () => {
    const r = rank(cs, [[scores('a', { identity: 9 }), scores('b'), scores('c', { readability: 4 })], [scores('a'), scores('b'), scores('c')]]);
    assert.equal(r[0].id, 'a');
    assert.equal(r[0].judges, 2);
    assert.equal(pickWinner(r)?.id, 'a');
  });
  it('enforces the hard limits whatever the total', () => {
    const r = rank(cs, [[scores('a', { culturalRespect: 3, novelty: 10, identity: 10 }), scores('b', { novelty: 4 }), scores('c', { readability: 4 })]]);
    assert.ok(r.every(x => x.rejected));
    assert.equal(pickWinner(r), null);
  });
  it('blends the decider novelty into the judge novelty at a quarter weight', () => {
    const r = rank([cs[0]], [[scores('a', { novelty: 8 })]], { a: 4 });
    assert.equal(r[0].scores.novelty, 7);
  });
  it('needs MIN_TOTAL to win', () => {
    const low = Object.fromEntries(['novelty', 'identity', 'readability', 'feasibility', 'accessibilityRisk', 'culturalRespect'].map(k => [k, 6])) as any;
    const r = rank([cs[0]], [[scores('a', { ...low, identity: 0, feasibility: 0 })]]);
    assert.ok(r[0].total < MIN_TOTAL);
    assert.equal(pickWinner(r), null);
  });
  it('breaks ties by novelty', () => {
    // novelty (0.25) = feasibility (0.15) + accessibilityRisk (0.10), so these two totals are equal.
    const r = rank(cs.slice(0, 2), [[scores('a', { novelty: 7, feasibility: 9, accessibilityRisk: 9 }), scores('b', { novelty: 8, feasibility: 8, accessibilityRisk: 8 })]]);
    assert.equal(r[0].total, r[1].total);
    assert.equal(r[0].id, 'b');
  });
});

describe('validators', () => {
  it('rejects a candidate with a bad fingerprint', () => {
    const bad = { candidates: [{ ...cand('a', 'Alpha'), fingerprint: { ...fp(), family: 'nope' } }] };
    assert.throws(() => validateCandidates(bad), /invalid fingerprint/);
  });
  it('requires a score for every shortlisted candidate, in range', () => {
    assert.throws(() => validateScores(['a', 'b'])({ scores: [scores('a')] }), /no score for candidate b/);
    assert.throws(() => validateScores(['a'])({ scores: [scores('a', { novelty: 11 })] }), /0-10/);
  });
});

describe('deciderNoveltyFrom', () => {
  it('blends P(none) and the novelty level onto 0-10', () => {
    assert.equal(deciderNoveltyFrom({ closest: { probabilities: { none: 0.5 } }, novelty: { score: 3 } }), 6.25);
  });
  it('returns undefined without answers', () => assert.equal(deciderNoveltyFrom({}), undefined));
});
