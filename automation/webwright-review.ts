/**
 * Webwright visual reviewer — the agentic "vision" half of the layout QA stage.
 *
 * Webwright (Microsoft Research's terminal-native web agent) drives a real
 * browser to inspect the rendered site for visual layout defects that pure
 * geometry can't judge: awkward spacing, misalignment, things that *look* wrong
 * even when boxes don't strictly overlap.
 *
 * This is intentionally NON-BLOCKING. Webwright is young and its output is a
 * trajectory, not a clean audit API, so any failure (not installed, bad parse,
 * timeout) degrades to an empty finding set and the stage proceeds on the
 * deterministic geometry report alone.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

export interface VisualFinding {
  source: 'webwright';
  page?: string;
  problem: string;
}

const FINDINGS_MARKER = 'FINDINGS_JSON:';

function reviewTask(): string {
  return [
    'Carefully inspect this web page for VISUAL LAYOUT DEFECTS only (not content).',
    'Look for: elements that overlap or touch awkwardly, inconsistent or cramped spacing',
    'between components, padding that looks wrong inside cards, misaligned elements,',
    'and content that appears cut off. Scroll the full page. Do NOT comment on colors,',
    'wording, or the overall style — only spacing/alignment/overlap geometry.',
    '',
    `When done, output a single line beginning with "${FINDINGS_MARKER}" followed by a`,
    'JSON array of objects like {"problem": "<short description with the element>"}.',
    'If the layout looks clean, output an empty array.',
  ].join(' ');
}

function isWebwrightAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const probe = spawn('python3', ['-c', 'import webwright'], { stdio: 'ignore' });
    probe.on('error', () => resolve(false));
    probe.on('close', code => resolve(code === 0));
  });
}

function runWebwrightOnce(startUrl: string, outDir: string, taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'python3',
      [
        '-m', 'webwright.run.cli',
        '-c', 'base.yaml',
        '-c', 'model_claude.yaml',
        '-t', reviewTask(),
        '--start-url', startUrl,
        '--task-id', taskId,
        '-o', outDir,
      ],
      {
        cwd: CONFIG.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WEBWRIGHT_MODEL: CONFIG.layoutQa.webwrightModel },
      },
    );
    let stdout = '';
    proc.stdout?.on('data', d => (stdout += d.toString()));
    proc.stderr?.on('data', () => {});
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('webwright timed out'));
    }, 180_000);
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', () => {
      clearTimeout(timer);
      // Persist stdout so we can parse findings even if no report.json is written.
      try {
        fs.writeFileSync(path.join(outDir, `${taskId}.stdout.txt`), stdout);
      } catch {
        /* best effort */
      }
      resolve();
    });
  });
}

// Pull a FINDINGS_JSON array out of whatever text webwright produced
// (its stdout, trajectory.json, or report.json).
function extractFindings(outDir: string, taskId: string, page: string): VisualFinding[] {
  const candidates = [
    path.join(outDir, `${taskId}.stdout.txt`),
    path.join(outDir, taskId, 'trajectory.json'),
    path.join(outDir, taskId, 'report.json'),
    path.join(outDir, 'trajectory.json'),
    path.join(outDir, 'report.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const idx = text.lastIndexOf(FINDINGS_MARKER);
    if (idx === -1) continue;
    const after = text.slice(idx + FINDINGS_MARKER.length);
    const start = after.indexOf('[');
    const end = after.indexOf(']', start);
    if (start === -1 || end === -1) continue;
    try {
      const arr = JSON.parse(after.slice(start, end + 1));
      if (Array.isArray(arr)) {
        return arr
          .map(item => ({
            source: 'webwright' as const,
            page,
            problem: typeof item === 'string' ? item : String(item?.problem ?? ''),
          }))
          .filter(f => f.problem.trim().length > 0);
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

/**
 * Review the given pages with webwright. Returns [] (with a console warning) on
 * any failure so the caller can proceed on geometry alone.
 */
export async function runWebwrightReview(
  baseUrl: string,
  pages: string[] = [...CONFIG.layoutQa.webwrightPages],
): Promise<VisualFinding[]> {
  if (!CONFIG.layoutQa.webwrightEnabled) return [];

  if (!(await isWebwrightAvailable())) {
    console.warn('[webwright] not installed (python module "webwright" missing) — skipping agentic visual review.');
    return [];
  }

  const outDir = path.join(CONFIG.testOutputDir, 'webwright');
  fs.mkdirSync(outDir, { recursive: true });
  const findings: VisualFinding[] = [];

  for (const page of pages) {
    const taskId = `review${page.replace(/\//g, '_') || '_home'}`;
    const url = `${baseUrl}${page}`;
    try {
      await runWebwrightOnce(url, outDir, taskId);
      findings.push(...extractFindings(outDir, taskId, page));
    } catch (err) {
      console.warn(`[webwright] review of ${page} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return findings;
}
