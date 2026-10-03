/**
 * Visual QA: screenshot one page per template at phone and desktop width, have a vision agent
 * judge each page, gate in code, and let the fixer repair blocking issues (bounded loop).
 *
 *   npx tsx pipeline/visual-qa.ts       # exit 0 = no blocking visual issue
 *
 * Writes test-output/visual/<page>-<width>.jpg, test-output/visual-qa.json and
 * test-output/visual-qa-summary.md. publish-shots.ts turns the screenshots into a PR gallery.
 */
import { execSync, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { CONFIG } from '../config.js';
import { templatePages, type TemplatePage } from '../e2e/site.js';
import { runAgent } from './agent.js';
import { runE2e } from './e2e-stage.js';
import { restoreAutomation } from './guard.js';

export const WIDTHS = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'desktop', width: 1280, height: 800 },
] as const;
const SHOTS = path.join(CONFIG.testOutputDir, 'visual');
const PORT = Number(process.env.VQA_PORT ?? 4331);
const MAX_PASSES = Number(process.env.VQA_MAX_FIX_PASSES ?? 2);
/** Long pages are cut at this height: the verdict needs the layout, not every paragraph. */
const MAX_SHOT_HEIGHT = 5000;
const log = (m: string) => process.stderr.write(`visual-qa: ${m}\n`);

export const KINDS = ['overlap', 'overflow', 'clipped', 'unreadable', 'missing-content', 'broken-image', 'contrast', 'off-style', 'other'] as const;

export interface Issue {
  severity: 'high' | 'medium' | 'low';
  kind: (typeof KINDS)[number];
  viewport: 'mobile' | 'desktop' | 'both';
  where: string;
  description: string;
}

export interface PageVerdict {
  rendersOk: boolean;
  styleFidelity: number;
  issues: Issue[];
  summary: string;
}

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    rendersOk: { type: 'boolean', description: 'false if the page is broken: blank, unstyled, error page, or main content missing' },
    styleFidelity: { type: 'number', description: '0 to 10: how fully the page executes the declared style' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          kind: { type: 'string', enum: [...KINDS] },
          viewport: { type: 'string', enum: ['mobile', 'desktop', 'both'] },
          where: { type: 'string', description: 'Which element or region, in plain words' },
          description: { type: 'string' },
        },
        required: ['severity', 'kind', 'viewport', 'where', 'description'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string', description: 'One sentence on how the page looks' },
  },
  required: ['rendersOk', 'styleFidelity', 'issues', 'summary'],
  additionalProperties: false,
};

export function validateVerdict(v: unknown): PageVerdict {
  const x = v as PageVerdict;
  if (typeof x?.rendersOk !== 'boolean') throw new Error('rendersOk must be a boolean');
  if (typeof x.styleFidelity !== 'number' || x.styleFidelity < 0 || x.styleFidelity > 10) throw new Error('styleFidelity must be 0-10');
  if (!Array.isArray(x.issues)) throw new Error('issues must be an array');
  for (const i of x.issues) {
    if (!['high', 'medium', 'low'].includes(i.severity)) throw new Error(`bad severity ${i.severity}`);
    if (!(KINDS as readonly string[]).includes(i.kind)) throw new Error(`bad kind ${i.kind}`);
  }
  return x;
}

/**
 * Kinds that block when rated high. "off-style", "contrast" and "other" are taste or are
 * already measured by the e2e/axe checks, so they are reported but never block.
 */
export const BLOCKING_KINDS = new Set<Issue['kind']>(['overlap', 'overflow', 'clipped', 'unreadable', 'missing-content', 'broken-image']);
/** A page whose style fidelity is below this is reported as off-style (never blocks). */
export const MIN_FIDELITY = 5;

export interface PageResult {
  page: TemplatePage;
  shots: string[];
  verdict?: PageVerdict;
  provider?: string;
  error?: string;
}

/** Code decides: a page blocks when it does not render or has a high issue of a blocking kind. */
export function blockingIssues(results: PageResult[]): { page: string; issue: Issue | { description: string } }[] {
  const out: { page: string; issue: Issue | { description: string } }[] = [];
  for (const r of results) {
    if (!r.verdict) continue; // a failed verdict is reported, not blocked on
    if (!r.verdict.rendersOk) out.push({ page: r.page.name, issue: { description: 'page does not render correctly' } });
    for (const i of r.verdict.issues) if (i.severity === 'high' && BLOCKING_KINDS.has(i.kind)) out.push({ page: r.page.name, issue: i });
  }
  return out;
}

// ---------- screenshots ----------

function serve(): ChildProcess {
  return spawn('npx', ['serve', 'dist', '-l', String(PORT), '--no-clipboard'], { cwd: CONFIG.projectRoot, stdio: 'ignore' });
}

async function waitFor(url: string, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`static server did not start on ${url}`);
}

export async function screenshot(pages: TemplatePage[]): Promise<Map<string, string[]>> {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = serve();
  const out = new Map<string, string[]>();
  try {
    await waitFor(`http://127.0.0.1:${PORT}/`);
    const channel = process.env.PLAYWRIGHT_CHROME_CHANNEL || undefined;
    const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    try {
      for (const p of pages) {
        const files: string[] = [];
        for (const w of WIDTHS) {
          const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
          const page = await ctx.newPage();
          await page.goto(`http://127.0.0.1:${PORT}${p.path}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          const height = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight));
          const file = path.join(SHOTS, `${p.name}-${w.width}.jpg`);
          // JPEG keeps a month of full-page shots small enough to commit to the gallery branch.
          await page.screenshot({ path: file, type: 'jpeg', quality: 75, clip: { x: 0, y: 0, width: w.width, height: Math.max(height, w.height) }, fullPage: true });
          files.push(file);
          await ctx.close();
        }
        out.set(p.name, files);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
  return out;
}

// ---------- verdicts ----------

function designContext(): string {
  try {
    const t = JSON.parse(fs.readFileSync(path.join(CONFIG.projectRoot, 'automation/history/current-trend.json'), 'utf-8'));
    return `Declared style: **${t.name}** — ${t.description}`;
  } catch {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(CONFIG.projectRoot, 'src/data/design-manifest.json'), 'utf-8'));
      return `Declared style: **${m.trend}** — ${m.description ?? ''}`;
    } catch {
      return 'Declared style: unknown — judge the page on its own idiom.';
    }
  }
}

const ROLE: Record<string, string> = {
  home: 'the home page: identity, latest posts, sections',
  about: 'the About page: a short biography',
  contact: 'the Contact page: how to reach the author',
  devops: 'a section page listing DevOps posts',
  programming: 'a section page listing programming posts',
  postgres: 'a section page listing Postgres posts',
  treks: 'a section page listing trekking trip reports',
  'post-code': 'a long technical blog post with code blocks',
  'post-trek': 'a trekking trip report with photos',
  tags: 'the index of all tags',
  tag: 'one tag page listing its posts',
  archive: 'the archive of past monthly designs',
  'archive-edition': 'a frozen copy of a past design (it is SUPPOSED to look different from this month)',
  '404': 'the not-found page',
};

function verdictPrompt(p: TemplatePage, context: string): string {
  return `You are the visual QA reviewer for sreeraj.dev, a personal tech blog redesigned in a new visual idiom every month.
${context}

The two screenshots show ${ROLE[p.name] ?? p.name} (${p.path}): first at phone width (390px), then at desktop width (1280px). Long pages are cut at ${MAX_SHOT_HEIGHT}px.

Report only what you can SEE in the screenshots. Judge the page against its declared idiom, not against minimalist taste: dense, loud or unusual layouts are fine when they are deliberate.

Severity:
- high: a reader is blocked or misled — overlapping text, content cut off or pushed off-screen, unreadable body text, missing main content, broken images.
- medium: clearly wrong but readable — awkward wraps, cramped spacing, a misaligned element.
- low: polish.

Set rendersOk=false only if the page is broken (blank, unstyled, an error, or its main content missing). styleFidelity is 0-10 for how fully this page executes the declared style.`;
}

async function judge(results: PageResult[]): Promise<void> {
  const context = designContext();
  const queue = [...results];
  const workers = Array.from({ length: Number(process.env.VQA_CONCURRENCY ?? 2) }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const res = await runAgent<PageVerdict>({
        role: 'visual_qa', label: `visual-qa:${r.page.name}`, prompt: verdictPrompt(r.page, context),
        images: r.shots, schema: VERDICT_SCHEMA, validate: validateVerdict,
      });
      if (res.ok) {
        r.verdict = res.data;
        r.provider = `${res.provider}/${res.model}`;
      } else r.error = res.error;
    }
  });
  await Promise.all(workers);
}

// ---------- fix loop ----------

function fixPrompt(blocking: ReturnType<typeof blockingIssues>): string {
  return `Visual QA found blocking layout problems on the sreeraj.dev redesign. Fix the SITE so they are gone, without changing the visual style.

${blocking.map(b => `- ${b.page}: ${'severity' in b.issue ? `[${b.issue.kind}, ${b.issue.viewport}] ${b.issue.where}: ` : ''}${b.issue.description}`).join('\n')}

Rules: edit only src/ (never automation/); keep the palette, typefaces and layout idea; keep every data-qa attribute; make the smallest change that fixes each root cause; prefer responsive CSS (media queries, min()/clamp(), minmax(0, 1fr)). Run \`npm run build\` to check it compiles. Do not commit.`;
}

function build(): boolean {
  try {
    execSync('npm run build', { cwd: CONFIG.projectRoot, stdio: ['ignore', 'ignore', 'inherit'], timeout: 5 * 60_000 });
    return true;
  } catch {
    return false;
  }
}

// ---------- report ----------

function summary(results: PageResult[], blocking: ReturnType<typeof blockingIssues>, notes: string[]): string {
  const lines = ['### Visual QA', ''];
  lines.push(`- Result: **${blocking.length ? `${blocking.length} blocking issue(s)` : 'no blocking issues'}** across ${results.length} page templates at 390px and 1280px`);
  lines.push(...notes.map(n => `- ${n}`), '');
  lines.push('| Page | Renders | Style fidelity | High | Medium | Low | Reviewer |', '|---|---|---|---|---|---|---|');
  for (const r of results) {
    const v = r.verdict;
    const n = (s: string) => v?.issues.filter(i => i.severity === s).length ?? '–';
    lines.push(`| ${r.page.name} | ${v ? (v.rendersOk ? 'yes' : '**no**') : 'n/a'} | ${v ? v.styleFidelity.toFixed(1) + (v.styleFidelity < MIN_FIDELITY ? ' ⚠' : '') : 'n/a'} | ${n('high')} | ${n('medium')} | ${n('low')} | ${r.provider ?? `failed: ${(r.error ?? '').slice(0, 40)}`} |`);
  }
  const shown = results.flatMap(r => (r.verdict?.issues ?? []).filter(i => i.severity !== 'low').map(i => `- **${r.page.name}** [${i.severity}, ${i.kind}, ${i.viewport}] ${i.where}: ${i.description}`));
  if (shown.length) lines.push('', '<details><summary>High and medium findings</summary>', '', ...shown.slice(0, 60), '', '</details>');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const pages = templatePages();
  const notes: string[] = [];
  let results: PageResult[] = [];
  let blocking: ReturnType<typeof blockingIssues> = [];

  for (let pass = 0; ; pass++) {
    const targets = pass === 0 ? pages : pages.filter(p => blocking.some(b => b.page === p.name));
    log(`${pass === 0 ? 'screenshots' : `re-check after fix pass ${pass}`}: ${targets.length} page(s)`);
    const shots = await screenshot(targets);
    const fresh: PageResult[] = targets.map(p => ({ page: p, shots: shots.get(p.name) ?? [] }));
    await judge(fresh);
    results = pass === 0 ? fresh : results.map(r => fresh.find(f => f.page.name === r.page.name) ?? r);
    blocking = blockingIssues(results);
    log(`pass ${pass}: ${blocking.length} blocking issue(s); verdicts ${results.filter(r => r.verdict).length}/${results.length}`);
    if (!blocking.length || pass >= MAX_PASSES) break;

    const fix = await runAgent({ role: 'fixer', label: `visual-fixer:${pass + 1}`, prompt: fixPrompt(blocking) });
    if (!fix.ok) {
      notes.push(`fix pass ${pass + 1}: no agent completed (${fix.error})`);
      break;
    }
    const restored = restoreAutomation();
    if (restored.length) notes.push(`fix pass ${pass + 1}: undid edits to ${restored.join(', ')}`);
    if (!build()) {
      notes.push(`fix pass ${pass + 1}: the site no longer builds — stopping`);
      break;
    }
    // A visual fix must not break the blocking invariants.
    const e2e = runE2e();
    if (!e2e.passed) notes.push(`fix pass ${pass + 1}: e2e now fails (${e2e.failures.slice(0, 3).join('; ')})`);
    notes.push(`fix pass ${pass + 1}: ${fix.provider}/${fix.model} edited the site for ${blocking.length} issue(s)`);
  }

  const failedVerdicts = results.filter(r => !r.verdict).length;
  if (failedVerdicts) notes.push(`${failedVerdicts} page(s) got no verdict (agent failure); they are reported, not blocked on`);
  fs.mkdirSync(CONFIG.testOutputDir, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'visual-qa.json'), JSON.stringify({ results, blocking, notes }, null, 2) + '\n');
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'visual-qa-summary.md'), summary(results, blocking, notes) + '\n');
  process.exit(blocking.length ? 1 : 0);
}

if (process.argv[1]?.endsWith('visual-qa.ts')) {
  main().catch(err => {
    log(`crashed: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
  });
}
