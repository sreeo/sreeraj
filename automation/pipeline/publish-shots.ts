/**
 * Publish the visual QA screenshots for the redesign PR.
 *
 *   npx tsx pipeline/publish-shots.ts <month> <run-id>
 *
 * Commits test-output/visual/*.jpg to the orphan branch `redesign-assets` under <month>/<run-id>/,
 * pushes it, and writes test-output/gallery.md: a table of phone and desktop thumbnails that
 * GitHub renders in the PR body (raw.githubusercontent.com, so the repo must be public). The
 * screenshots never enter main. Exit 0 even on failure: the gallery is a convenience.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG } from '../config.js';
import { templatePages } from '../e2e/site.js';
import { WIDTHS } from './visual-qa.js';

const BRANCH = 'redesign-assets';
const SHOTS = path.join(CONFIG.testOutputDir, 'visual');
const log = (m: string) => process.stderr.write(`publish-shots: ${m}\n`);

function git(args: string[], cwd = CONFIG.projectRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** "https://github.com/owner/repo(.git)" or "git@github.com:owner/repo" → "owner/repo". */
export function repoSlug(remote: string): string {
  const m = /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(remote.trim());
  if (!m) throw new Error(`not a GitHub remote: ${remote}`);
  return m[1];
}

export function galleryMarkdown(slug: string, dir: string, pages: string[], files: Set<string>): string {
  const url = (f: string) => `https://raw.githubusercontent.com/${slug}/${BRANCH}/${dir}/${f}`;
  const lines = ['### Screenshots', '', '| Page | Phone (390px) | Desktop (1280px) |', '|---|---|---|'];
  for (const p of pages) {
    const cells = WIDTHS.map(w => {
      const f = `${p}-${w.width}.jpg`;
      return files.has(f) ? `<a href="${url(f)}"><img src="${url(f)}" width="${w.width === 390 ? 120 : 260}" alt="${p} at ${w.width}px"></a>` : '–';
    });
    lines.push(`| ${p} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

function main(): void {
  const [month, runId] = process.argv.slice(2);
  if (!month || !runId) throw new Error('usage: publish-shots.ts <month> <run-id>');
  const files = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter(f => f.endsWith('.jpg')) : [];
  if (!files.length) {
    log('no screenshots to publish');
    return;
  }
  const slug = repoSlug(git(['remote', 'get-url', 'origin']));
  const dir = `${month}/${runId}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  try {
    const exists = !!git(['ls-remote', '--heads', 'origin', BRANCH]);
    if (exists) {
      git(['fetch', '-q', 'origin', BRANCH]);
      git(['worktree', 'add', '-q', '--detach', tmp, 'FETCH_HEAD']);
      git(['checkout', '-q', '-B', BRANCH], tmp);
    } else {
      git(['worktree', 'add', '-q', '--detach', tmp]);
      git(['checkout', '-q', '--orphan', BRANCH], tmp);
      git(['rm', '-rq', '--cached', '.'], tmp);
      for (const f of fs.readdirSync(tmp)) if (f !== '.git') fs.rmSync(path.join(tmp, f), { recursive: true, force: true });
      fs.writeFileSync(path.join(tmp, 'README.md'), '# redesign-assets\n\nScreenshots from the monthly redesign visual QA, linked from the redesign PRs. Never merged into main.\n');
    }
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
    for (const f of files) fs.copyFileSync(path.join(SHOTS, f), path.join(tmp, dir, f));
    git(['add', '-A'], tmp);
    git(['-c', 'user.name=redesign-bot', '-c', 'user.email=redesign-bot@users.noreply.github.com', 'commit', '-qm', `Screenshots for ${dir}`], tmp);
    git(['push', '-q', 'origin', `HEAD:refs/heads/${BRANCH}`], tmp);
    const pages = templatePages().map(p => p.name);
    fs.writeFileSync(path.join(CONFIG.testOutputDir, 'gallery.md'), galleryMarkdown(slug, dir, pages, new Set(files)) + '\n');
    log(`published ${files.length} screenshot(s) to ${BRANCH}/${dir}`);
  } finally {
    try {
      git(['worktree', 'remove', '--force', tmp]);
    } catch {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

if (process.argv[1]?.endsWith('publish-shots.ts')) {
  try {
    main();
  } catch (err) {
    log(`failed (continuing without a gallery): ${err instanceof Error ? err.message : err}`);
  }
}
