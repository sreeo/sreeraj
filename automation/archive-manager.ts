import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { DesignManifest } from './design-generator.js';

export interface ArchiveEntry {
  month: string;
  trend: string;
  description: string;
  primaryColor: string;
  deployedAt: string;
}

export interface ArchiveRegistry {
  archives: ArchiveEntry[];
}

// Directories to skip when copying to archive (they're shared with the main site)
const SKIP_DIRS = new Set(['images']);

function copyDirSync(src: string, dest: string, isRoot = false) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip large shared directories at the root level
    if (isRoot && SKIP_DIRS.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Rewrite all absolute asset paths in HTML files to be relative to the archive directory.
 * e.g., href="/_astro/foo.css" → href="/archive/2026-02/_astro/foo.css"
 * and href="/about/" → href="/archive/2026-02/about/"
 */
function rewritePathsInArchive(archiveDir: string, archivePrefix: string): void {
  const htmlFiles = findFiles(archiveDir, '.html');
  let rewriteCount = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;

    // Rewrite href="/..." and src="/..." to use archive prefix
    // But don't rewrite external URLs (https://, http://, //) or anchor links (#)
    // Match: href="/" or href="/anything" or src="/anything"
    content = content.replace(
      /((?:href|src|action)=")\/(?!\/|archive\/)(.*?)"([^>]*>)/g,
      (match, prefix, urlPath, suffix) => {
        // Don't rewrite absolute external URLs or data: URIs
        if (urlPath.startsWith('http') || urlPath.startsWith('data:')) return match;
        return `${prefix}${archivePrefix}/${urlPath}"${suffix}`;
      }
    );

    // Also fix url() references in inline styles
    content = content.replace(
      /url\(\/(?!\/|archive\/)(.*?)\)/g,
      (match, urlPath) => {
        return `url(${archivePrefix}/${urlPath})`;
      }
    );

    // Inject an archive banner + "Current Site" link into the navbar
    // Find the closing </nav> and insert before it
    const [year, month] = archivePrefix.split('/').pop()!.split('-');
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', { month: 'long' });
    const bannerHtml = `<a href="/" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#000;color:#fff;text-align:center;padding:6px 12px;font-size:13px;font-family:system-ui,sans-serif;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0.92;">
  <span>You're viewing the <strong>${monthName} ${year}</strong> archived design</span>
  <span style="background:#fff;color:#000;padding:2px 10px;border-radius:4px;font-weight:600;">View Current Site &rarr;</span>
</a>
<div style="height:32px;"></div>`;

    // Insert after opening <body...>
    content = content.replace(
      /(<body[^>]*>)/,
      `$1${bannerHtml}`
    );

    if (content !== original) {
      fs.writeFileSync(file, content);
      rewriteCount++;
    }
  }

  console.log(`  Rewrote paths in ${rewriteCount} HTML files`);
}

/**
 * After path rewriting, image paths point to /archive/{month}/images/...
 * Rewrite them back to /images/... since images are shared with the main site.
 */
function fixImagePaths(archiveDir: string, archivePrefix: string): void {
  const htmlFiles = findFiles(archiveDir, '.html');
  let count = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;

    content = content.replaceAll(`${archivePrefix}/images/`, '/images/');
    content = content.replaceAll(`${archivePrefix}/favicon`, '/favicon');

    if (content !== original) {
      fs.writeFileSync(file, content);
      count++;
    }
  }

  console.log(`  Fixed image/favicon paths in ${count} HTML files`);
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function archiveCurrentDesign(manifest: DesignManifest): Promise<void> {
  const monthKey = manifest.month;
  const archiveMonthDir = path.join(CONFIG.archiveDir, monthKey);
  const archivePrefix = `/archive/${monthKey}`;

  console.log(`Archiving current design to ${archiveMonthDir}...`);

  // Build current site first
  console.log('Building current site for archive...');
  execSync('npm run build', {
    cwd: CONFIG.projectRoot,
    stdio: 'pipe',
    timeout: 120_000,
  });

  const distDir = path.join(CONFIG.projectRoot, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ directory not found after build');
  }

  // Copy dist/ to archive
  if (fs.existsSync(archiveMonthDir)) {
    fs.rmSync(archiveMonthDir, { recursive: true });
  }
  copyDirSync(distDir, archiveMonthDir, true);

  // Rewrite all absolute paths in HTML files to point within the archive
  console.log('Rewriting asset paths for archive...');
  rewritePathsInArchive(archiveMonthDir, archivePrefix);

  // Fix image paths back to the main site (images are shared, not duplicated)
  console.log('Fixing image paths to use shared /images/...');
  fixImagePaths(archiveMonthDir, archivePrefix);

  // Update registry
  const registry: ArchiveRegistry = fs.existsSync(CONFIG.registryPath)
    ? JSON.parse(fs.readFileSync(CONFIG.registryPath, 'utf-8'))
    : { archives: [] };

  // Remove existing entry for this month if any
  registry.archives = registry.archives.filter(a => a.month !== monthKey);

  registry.archives.push({
    month: monthKey,
    trend: manifest.trend,
    description: manifest.description,
    primaryColor: manifest.primaryColor,
    deployedAt: new Date().toISOString(),
  });

  // Sort by month descending
  registry.archives.sort((a, b) => b.month.localeCompare(a.month));

  fs.writeFileSync(CONFIG.registryPath, JSON.stringify(registry, null, 2));
  console.log(`Archive complete. Registry updated with ${registry.archives.length} entries.`);

  // Cleanup old archives (> maxArchiveMonths)
  if (registry.archives.length > CONFIG.maxArchiveMonths) {
    const toRemove = registry.archives.slice(CONFIG.maxArchiveMonths);
    for (const entry of toRemove) {
      const oldDir = path.join(CONFIG.archiveDir, entry.month);
      if (fs.existsSync(oldDir)) {
        fs.rmSync(oldDir, { recursive: true });
        console.log(`Cleaned up old archive: ${entry.month}`);
      }
    }
    registry.archives = registry.archives.slice(0, CONFIG.maxArchiveMonths);
    fs.writeFileSync(CONFIG.registryPath, JSON.stringify(registry, null, 2));
  }
}
