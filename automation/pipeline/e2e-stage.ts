/**
 * E2E stage: run the blocking e2e checks on the built site and, if they fail, let the fixer
 * agent repair the site, rebuild and re-check — up to E2E_MAX_FIX_PASSES times.
 *
 *   npx tsx pipeline/e2e-stage.ts     # exit 0 = all blocking checks pass
 *
 * Writes test-output/e2e-summary.md for the PR body. The fixer may not edit automation/; any
 * such edit is undone before the re-check.
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { runAgent } from './agent.js';
import { restoreAutomation } from './guard.js';

const MAX_PASSES = Number(process.env.E2E_MAX_FIX_PASSES ?? 3);
const REPORT = path.join(CONFIG.testOutputDir, 'e2e-report.json');
const log = (m: string) => process.stderr.write(`e2e-stage: ${m}\n`);
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

export interface E2eResult {
  passed: boolean;
  expected: number;
  unexpected: number;
  failures: string[];
}

/** Run the @hard checks and read the JSON report. */
export function runE2e(): E2eResult {
  fs.rmSync(REPORT, { force: true });
  spawnSync('npx', ['playwright', 'test', '-c', 'e2e/playwright.config.ts', '--grep', '@hard'], {
    cwd: path.join(CONFIG.projectRoot, 'automation'),
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, E2E_WORKERS: process.env.E2E_WORKERS ?? '2' },
    timeout: 20 * 60_000,
  });
  if (!fs.existsSync(REPORT)) return { passed: false, expected: 0, unexpected: 1, failures: ['the e2e suite did not produce a report (it crashed or timed out)'] };
  return parseReport(JSON.parse(fs.readFileSync(REPORT, 'utf-8')));
}

/** Playwright JSON report → pass/fail plus one line per failed (soft) assertion. */
export function parseReport(report: any): E2eResult {
  const failures: string[] = [];
  const walk = (suite: any) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          if (r.status === 'passed') continue;
          const msgs = (r.errors?.length ? r.errors : [r.error]).filter(Boolean).map((e: any) => stripAnsi(e.message ?? String(e)).split('\n')[0]);
          for (const m of msgs.length ? msgs : [`${r.status}`]) failures.push(`${spec.title} — ${m}`);
        }
      }
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of report.suites ?? []) walk(s);
  const stats = report.stats ?? {};
  return { passed: (stats.unexpected ?? 1) === 0, expected: stats.expected ?? 0, unexpected: stats.unexpected ?? 0, failures: [...new Set(failures)] };
}

function build(): boolean {
  try {
    execSync('npm run build', { cwd: CONFIG.projectRoot, stdio: ['ignore', 'ignore', 'inherit'], timeout: 5 * 60_000 });
    return true;
  } catch {
    return false;
  }
}

function fixPrompt(failures: string[]): string {
  return `The sreeraj.dev redesign builds, but its blocking e2e checks fail. Fix the SITE so they pass, without changing the design's visual style.

Failing checks (each line names the page and the check):
${failures.slice(0, 60).map(f => `- ${f}`).join('\n')}

Rules:
- Edit only files under src/ (and public/ assets if truly needed). Never edit anything under automation/ — it is the test suite.
- Keep the chosen style: palette, typefaces and layout idea stay. Make the smallest change that fixes each root cause.
- The data-qa markup contract: site-nav (Header, once per page, links to /, /about/, /devops/, /treks/, /programming/, /postgres/, /archive/), post-list, post-card (>= 3 on the home page), post-title (the post <h1>), post-body (wraps <Content />), tag-list, site-footer, contact.
- Every page needs HTTP 200, a <title>, at least one <h1>, no JavaScript errors, no broken same-site requests, and no horizontal scroll at 390/768/1280px. Post body text >= 15px.

You may run \`npm run build\` and then \`cd automation && npm run test:e2e:hard\` to check your work. Do not commit.`;
}

function summary(result: E2eResult, passes: number, notes: string[]): string {
  const lines = ['### E2E (blocking checks)', ''];
  lines.push(`- Result: **${result.passed ? 'passed' : 'failed'}** — ${result.expected} passed, ${result.unexpected} failed${passes ? ` after ${passes} fix pass(es)` : ''}`);
  lines.push(...notes.map(n => `- ${n}`));
  if (!result.passed) {
    lines.push('', '<details><summary>Failing checks</summary>', '', ...result.failures.slice(0, 40).map(f => `- ${f}`), '', '</details>');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  let result = runE2e();
  log(`initial: ${result.expected} passed, ${result.unexpected} failed`);
  const notes: string[] = [];
  let passes = 0;
  while (!result.passed && passes < MAX_PASSES) {
    passes++;
    log(`fix pass ${passes}/${MAX_PASSES}: ${result.failures.length} failure line(s)`);
    const r = await runAgent({ role: 'fixer', label: `e2e-fixer:${passes}`, prompt: fixPrompt(result.failures) });
    if (!r.ok) {
      notes.push(`fix pass ${passes}: no agent completed (${r.error})`);
      break;
    }
    const restored = restoreAutomation();
    if (restored.length) notes.push(`fix pass ${passes}: undid edits to ${restored.join(', ')}`);
    if (!build()) {
      notes.push(`fix pass ${passes}: the site no longer builds`);
      result = { passed: false, expected: 0, unexpected: 1, failures: ['npm run build failed after the fix pass'] };
      continue;
    }
    const before = result.failures.length;
    result = runE2e();
    log(`after pass ${passes}: ${result.expected} passed, ${result.unexpected} failed`);
    if (!result.passed && result.failures.length >= before) notes.push(`fix pass ${passes}: no improvement (${before} → ${result.failures.length} failure lines)`);
  }
  fs.mkdirSync(CONFIG.testOutputDir, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'e2e-summary.md'), summary(result, passes, notes) + '\n');
  process.exit(result.passed ? 0 : 1);
}

if (process.argv[1]?.endsWith('e2e-stage.ts')) {
  main().catch(err => {
    log(`crashed: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
  });
}
