/**
 * Layout QA & Fix stage — the orchestrator the CI invokes after the creative
 * redesign has produced a themed CSS (i.e. once the *style* is decided).
 *
 * Pipeline:
 *   build → geometry analysis (deterministic gate)
 *         + webwright agentic visual review (non-blocking "vision" half)
 *   → if clean, done
 *   → else: fix loop [ Agent SDK fixer → rebuild → re-analyze ] up to N passes
 *   → regression guard (reuse the existing contract/contrast/render validation)
 *   → write report for the PR body
 *
 * Deterministic geometry is the gate; the agentic review only adds corroborating
 * findings. This keeps the stage's pass/fail reproducible and not at the mercy
 * of a model's mood.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import {
  analyzeLayout,
  startServer,
  waitForServer,
  killServer,
  type LayoutReport,
} from './layout-geometry.js';
import { runWebwrightReview, type VisualFinding } from './webwright-review.js';
import { runFixPass, type ConsolidatedIssues } from './layout-fixer.js';
import { validateDesign } from './validate-design.js';

interface StageReport {
  passed: boolean;
  passes: number;
  initial: { high: number; medium: number; total: number };
  final: { high: number; medium: number; total: number };
  webwrightFindings: VisualFinding[];
  fixSummaries: string[];
  regression: { passed: boolean; failedStep?: string } | null;
  finalReport: LayoutReport;
}

function counts(r: LayoutReport) {
  return {
    high: r.bySeverity['high'] || 0,
    medium: r.bySeverity['medium'] || 0,
    total: r.total,
  };
}

function build(): void {
  execSync('npm run build', { cwd: CONFIG.projectRoot, stdio: 'inherit', timeout: 180_000 });
}

async function webwrightReview(port: number): Promise<VisualFinding[]> {
  let server = null;
  try {
    server = startServer(port);
    if (!(await waitForServer(port))) {
      console.warn('[webwright] static server failed to start — skipping review.');
      return [];
    }
    return await runWebwrightReview(`http://localhost:${port}`);
  } catch (err) {
    console.warn(`[webwright] review skipped: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  } finally {
    killServer(server);
  }
}

async function main() {
  console.log('=== Layout QA & Fix stage ===');

  build();
  let geometry = await analyzeLayout();
  const initial = counts(geometry);
  console.log(`Initial geometry: ${JSON.stringify(initial)}`);

  // Agentic visual review (non-blocking). Adds corroborating findings only.
  const webwrightFindings = await webwrightReview(4193);
  if (webwrightFindings.length) {
    console.log(`Webwright surfaced ${webwrightFindings.length} visual finding(s).`);
  }

  const fixSummaries: string[] = [];
  let passes = 0;

  // Gate on high-severity geometry. Medium issues are reported but don't block.
  while ((geometry.bySeverity['high'] || 0) > 0 && passes < CONFIG.layoutQa.maxFixPasses) {
    passes++;
    console.log(`\n--- Fix pass ${passes}/${CONFIG.layoutQa.maxFixPasses} ---`);

    const issues: ConsolidatedIssues = {
      geometry: geometry.violations.filter(v => v.severity === 'high' || v.severity === 'medium'),
      visual: webwrightFindings.map(f => ({ source: f.source, page: f.page, problem: f.problem })),
    };

    const before = geometry.bySeverity['high'] || 0;
    try {
      const summary = await runFixPass(issues);
      fixSummaries.push(summary.changes || '(no summary returned)');
      console.log(`Fixer changed: ${summary.filesChanged.join(', ') || '(unreported)'}`);
    } catch (err) {
      console.error(`Fix pass failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    build();
    geometry = await analyzeLayout();
    const after = geometry.bySeverity['high'] || 0;
    console.log(`High-severity: ${before} → ${after}`);

    // Bail if a pass made things worse — don't churn into a worse design.
    if (after >= before) {
      console.warn('No improvement this pass; stopping the fix loop.');
      break;
    }
  }

  // Regression guard: reuse the existing validation (CSS contract, contrast,
  // build, render). A layout fix must not break the class contract or palette.
  let regression: StageReport['regression'] = null;
  try {
    const css = fs.readFileSync(CONFIG.globalCssPath, 'utf-8');
    const result = await validateDesign(css);
    const failed = result.steps.find(s => !s.passed && ['CSS Contract', 'Contrast', 'Build', 'Page Render'].includes(s.name));
    regression = { passed: !failed, failedStep: failed?.name };
    if (failed) console.error(`Regression guard FAILED at: ${failed.name} — ${failed.message}`);
  } catch (err) {
    regression = { passed: false, failedStep: `validation error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const final = counts(geometry);
  const passed = (geometry.bySeverity['high'] || 0) === 0 && (regression?.passed ?? true);

  const report: StageReport = {
    passed,
    passes,
    initial,
    final,
    webwrightFindings,
    fixSummaries,
    regression,
    finalReport: geometry,
  };

  fs.mkdirSync(CONFIG.testOutputDir, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'layout-qa-report.json'), JSON.stringify(report, null, 2));
  writeMarkdown(report);

  console.log(`\n=== Layout QA ${passed ? 'PASSED' : 'FAILED'} === high: ${initial.high} → ${final.high} over ${passes} pass(es)`);
  process.exit(passed ? 0 : 1);
}

function writeMarkdown(r: StageReport): void {
  const lines: string[] = [];
  lines.push('### Layout QA');
  lines.push('');
  lines.push(`- Result: **${r.passed ? 'passed' : 'failed'}**`);
  lines.push(`- High-severity geometry issues: ${r.initial.high} → ${r.final.high} (over ${r.passes} fix pass(es))`);
  lines.push(`- Remaining medium issues: ${r.final.medium}`);
  if (r.regression) lines.push(`- Regression guard: ${r.regression.passed ? 'ok' : `FAILED at ${r.regression.failedStep}`}`);
  if (r.webwrightFindings.length) {
    lines.push(`- Webwright visual findings: ${r.webwrightFindings.length}`);
  }
  if (r.fixSummaries.length) {
    lines.push('');
    lines.push('<details><summary>Fix summary</summary>');
    lines.push('');
    r.fixSummaries.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
    lines.push('</details>');
  }
  fs.writeFileSync(path.join(CONFIG.testOutputDir, 'layout-qa-summary.md'), lines.join('\n'));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
