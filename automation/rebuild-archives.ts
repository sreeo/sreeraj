/**
 * Rebuild archived editions from their source + the CURRENT content.
 *
 * Archived designs (public/archive/<month>/) are frozen *design*, but should
 * stay live with respect to *content* — every blog post we add should appear in
 * every past theme too. Since the snapshots are baked HTML with no templates,
 * the only sound way is to rebuild each edition from its source presentation
 * with today's content, then re-freeze it.
 *
 * For each registry entry that has a `sourceRef` (a git commit/tag of that
 * edition's source), this:
 *   1. checks the source out in a throwaway git worktree,
 *   2. overlays the current src/content (+ schema) so it builds with all posts,
 *   3. npm run build,
 *   4. snapshots dist/ into public/archive/<month>/ with the same absolute-path
 *      rewrite + "frozen" banner the archive-manager uses.
 *
 * Run in the deploy pipeline (so archives are always content-fresh) or manually
 * via `npm run archives:rebuild`.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG } from './config.js';

interface Edition {
  month: string;
  trend: string;
  description: string;
  primaryColor: string;
  deployedAt: string;
  sourceRef?: string;
}

const ROOT = CONFIG.projectRoot;
const ARCHIVE_DIR = CONFIG.archiveDir;
const REGISTRY = CONFIG.registryPath;
const SKIP_DIRS = new Set(['images']); // images are shared with the live site

function sh(cmd: string, cwd = ROOT): string {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// --- snapshot helpers (mirrors archive-manager.ts) ---

function copyDirSync(src: string, dest: string, isRoot = false): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (isRoot && SKIP_DIRS.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function findFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function rewriteAndBanner(archiveDir: string, month: string): void {
  const prefix = `/archive/${month}`;
  const [year, mon] = month.split('-');
  const monthName = new Date(Number(year), Number(mon) - 1).toLocaleString('en', { month: 'long' });
  const banner = `<a href="/" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#000;color:#fff;text-align:center;padding:6px 12px;font-size:13px;font-family:system-ui,sans-serif;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0.92;">
  <span>You're viewing the <strong>${monthName} ${year}</strong> archived design</span>
  <span style="background:#fff;color:#000;padding:2px 10px;border-radius:4px;font-weight:600;">View Current Site &rarr;</span>
</a>
<div style="height:32px;"></div>`;

  for (const file of findFiles(archiveDir, '.html')) {
    let c = fs.readFileSync(file, 'utf-8');
    // absolute href/src/action -> archive-prefixed (skip external + data:)
    c = c.replace(/((?:href|src|action)=")\/(?!\/|archive\/)(.*?)"([^>]*>)/g, (m, p, url, suf) =>
      url.startsWith('http') || url.startsWith('data:') ? m : `${p}${prefix}/${url}"${suf}`,
    );
    c = c.replace(/url\(\/(?!\/|archive\/)(.*?)\)/g, (_m, url) => `url(${prefix}/${url})`);
    // images + favicon stay shared with the live site
    c = c.replaceAll(`${prefix}/images/`, '/images/').replaceAll(`${prefix}/favicon`, '/favicon');
    // inject the frozen banner after <body>
    c = c.replace(/(<body[^>]*>)/, `$1${banner}`);
    fs.writeFileSync(file, c);
  }
}

// --- per-edition rebuild ---

function rebuildEdition(ed: Edition): boolean {
  if (!ed.sourceRef) {
    console.log(`  ${ed.month}: no sourceRef — skipped (cannot rebuild without source).`);
    return false;
  }
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), `edition-${ed.month}-`));
  try {
    console.log(`  ${ed.month} (${ed.trend}) — source ${ed.sourceRef}`);
    sh(`git worktree add --detach --force "${wt}" "${ed.sourceRef}"`);

    // Overlay current content + schema so the old design builds with all posts.
    sh(`rsync -a --delete "${ROOT}/src/content/" "${wt}/src/content/"`);
    if (fs.existsSync(`${ROOT}/src/content.config.ts`)) {
      fs.copyFileSync(`${ROOT}/src/content.config.ts`, `${wt}/src/content.config.ts`);
    }
    // Reuse the live node_modules (deps are identical across editions) for speed.
    if (!fs.existsSync(`${wt}/node_modules`)) {
      fs.symlinkSync(`${ROOT}/node_modules`, `${wt}/node_modules`, 'dir');
    }

    execSync('npm run build', { cwd: wt, stdio: 'pipe', timeout: 180_000 });

    const dest = path.join(ARCHIVE_DIR, ed.month);
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirSync(path.join(wt, 'dist'), dest, true);
    rewriteAndBanner(dest, ed.month);
    console.log(`  ${ed.month}: rebuilt ✓`);
    return true;
  } catch (err) {
    console.error(`  ${ed.month}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    try {
      sh(`git worktree remove --force "${wt}"`);
    } catch {
      fs.rmSync(wt, { recursive: true, force: true });
    }
    try {
      sh('git worktree prune');
    } catch {
      /* best effort */
    }
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(REGISTRY)) {
    console.log('No archive registry — nothing to rebuild.');
    return;
  }
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')) as { archives: Edition[] };
  const editions = registry.archives ?? [];
  console.log(`Rebuilding ${editions.length} archived edition(s) with current content...`);

  let rebuilt = 0;
  let skipped = 0;
  for (const ed of editions) {
    if (rebuildEdition(ed)) rebuilt++;
    else skipped++;
  }

  console.log(`\nDone: ${rebuilt} rebuilt, ${skipped} skipped.`);
  if (skipped > 0) {
    console.log('Skipped editions lack a `sourceRef` in registry.json (add one to enable rebuilds).');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
