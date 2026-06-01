/**
 * Deterministic layout-geometry analyzer.
 *
 * Renders the built site with Playwright across desktop + mobile viewports and
 * measures real DOM geometry to catch the failure modes a vision model misses:
 *   - elements that visually overlap / intersect
 *   - horizontal page overflow (stray scrollbar)
 *   - elements bleeding outside the viewport
 *   - zero-size elements that still carry content
 *   - text clipped by its container
 *
 * This is the *deterministic* half of the layout QA stage. It emits a stable
 * JSON report (the contract the fixer agent consumes) and never depends on an
 * LLM, so its output is reproducible and verifiable on its own.
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

// --- Tuning knobs (calibrated against a known-good design) ---

// Elements we judge for overlap/overflow. Curated from the CSS class contract:
// real content blocks, not decorative/background layers.
const CONTENT_SELECTORS = [
  '.nav-brand',
  '.post-card',
  '.post-card-title',
  '.post-card-description',
  '.tag-pill',
  '.section-title',
  '.page-title',
  '.page-description',
  '.post-header-title',
  '.post-header-meta',
  '.site-footer',
  'main h1',
  'main h2',
  'main h3',
  '.prose p',
  '.prose li',
  '.git-log-timeline',
];

// Never flagged — intentionally layered, positioned, or decorative.
const EXCLUDE_SELECTORS = [
  '.flow-field-canvas',
  '.mountain-canvas',
  '.mountain-skyline',
  '.trek-hero-overlay',
  '.trek-hero-tag',
  '.cursor-blink',
  '.gl-graph',
  '.gl-graph-col',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

// Geometry tolerances (px). Subpixel rounding and 1px borders must not trip us.
const OVERFLOW_TOL = 2; // how far past the viewport edge counts as overflow
const OVERLAP_MIN = 4; // min intersection in BOTH axes to count as a real overlap
const SAME_LINE_TOL = 6; // vertical delta under which two inline items share a line

export type Severity = 'high' | 'medium' | 'low';
export type ViolationType =
  | 'overlap'
  | 'page-overflow'
  | 'element-overflow'
  | 'zero-size'
  | 'clipped-text';

export interface Violation {
  type: ViolationType;
  severity: Severity;
  page: string;
  viewport: string;
  selector: string;
  detail: string;
  // Raw measurements so the fixer can reason precisely.
  measurements?: Record<string, number>;
  // How many identical instances were collapsed into this one (e.g. 20 cards
  // sharing the same root cause). 1 unless deduped.
  occurrences?: number;
}

export interface LayoutReport {
  generatedAt: string;
  pagesChecked: string[];
  viewports: string[];
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  violations: Violation[];
}

// Shape returned from the in-browser collector for a single element.
interface ElementSnapshot {
  id: number;
  selector: string;
  matched: string; // which CONTENT_SELECTOR matched
  ancestors: number[]; // ids of collected elements that DOM-contain this one
  rect: { x: number; y: number; w: number; h: number };
  position: string;
  display: string;
  overflowX: string;
  scrollW: number;
  clientW: number;
  hasText: boolean;
  // Truncation intent — so we don't flag deliberate ellipsis/line-clamp.
  textOverflow: string;
  lineClamp: string;
  whiteSpace: string;
}

interface PageSnapshot {
  docScrollW: number;
  docClientW: number;
  elements: ElementSnapshot[];
}

// --- Server helpers (self-contained; mirrors validate-design.ts) ---

export function startServer(port: number): ChildProcess {
  const server = spawn('npx', ['serve', 'dist', '-l', String(port), '--no-clipboard'], {
    cwd: CONFIG.projectRoot,
    stdio: 'pipe',
    detached: false,
  });
  server.on('error', () => {});
  return server;
}

export function killServer(server: ChildProcess | null): void {
  if (!server || server.killed) return;
  try {
    server.kill('SIGKILL');
  } catch {
    /* already dead */
  }
}

export async function waitForServer(port: number, timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// --- In-browser geometry collector ---
// Runs inside the page. Returns plain data (no DOM refs) for Node-side analysis.
function collectSnapshot(contentSelectors: string[], excludeSelectors: string[]): PageSnapshot {
  const excluded = new Set<Element>();
  for (const sel of excludeSelectors) {
    document.querySelectorAll(sel).forEach(el => {
      excluded.add(el);
      el.querySelectorAll('*').forEach(c => excluded.add(c));
    });
  }

  // Build a unique, ordered list of candidate elements with which selector matched.
  const matchOf = new Map<Element, string>();
  for (const sel of contentSelectors) {
    document.querySelectorAll(sel).forEach(el => {
      if (excluded.has(el)) return;
      if (!matchOf.has(el)) matchOf.set(el, sel);
    });
  }

  const els = Array.from(matchOf.keys());
  const indexOf = new Map<Element, number>();
  els.forEach((el, i) => indexOf.set(el, i));

  const cssPath = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && depth < 4) {
      let part = node.tagName.toLowerCase();
      const cls = (node.getAttribute('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      if (cls) part += '.' + cls;
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  };

  const snapshots: ElementSnapshot[] = els.map((el, i) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    // Collected ancestors (so Node can skip parent/child pairs).
    const ancestors: number[] = [];
    let p = el.parentElement;
    while (p) {
      const idx = indexOf.get(p);
      if (idx !== undefined) ancestors.push(idx);
      p = p.parentElement;
    }
    return {
      id: i,
      selector: cssPath(el),
      matched: matchOf.get(el)!,
      ancestors,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      position: style.position,
      display: style.display,
      overflowX: style.overflowX,
      scrollW: (el as HTMLElement).scrollWidth,
      clientW: (el as HTMLElement).clientWidth,
      hasText: (el.textContent || '').trim().length > 0,
      textOverflow: style.textOverflow,
      lineClamp: style.webkitLineClamp || (style as any).lineClamp || 'none',
      whiteSpace: style.whiteSpace,
    };
  });

  return {
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    elements: snapshots,
  };
}

// --- Node-side classification ---

function isVisible(e: ElementSnapshot): boolean {
  return e.display !== 'none' && e.rect.w >= 0 && e.rect.h >= 0;
}

function isPositioned(e: ElementSnapshot): boolean {
  return e.position === 'absolute' || e.position === 'fixed' || e.position === 'sticky';
}

function isInline(e: ElementSnapshot): boolean {
  return e.display.startsWith('inline');
}

function intersect(a: ElementSnapshot, b: ElementSnapshot): { ox: number; oy: number } {
  const ox = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
  const oy = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
  return { ox, oy };
}

function classifyPage(
  page: string,
  viewport: string,
  snap: PageSnapshot,
): Violation[] {
  const out: Violation[] = [];
  const vw = snap.docClientW;

  // 1. Page-level horizontal overflow → stray scrollbar.
  if (snap.docScrollW > snap.docClientW + OVERFLOW_TOL) {
    out.push({
      type: 'page-overflow',
      severity: 'high',
      page,
      viewport,
      selector: 'html',
      detail: `Page scrolls horizontally: content width ${snap.docScrollW}px exceeds viewport ${snap.docClientW}px.`,
      measurements: { scrollWidth: snap.docScrollW, clientWidth: snap.docClientW },
    });
  }

  const visible = snap.elements.filter(
    e => isVisible(e) && e.rect.w > 0 && e.rect.h > 0,
  );

  // 2. Element bleeding outside the viewport horizontally. An overflowing card
  //    drags all its children out too — report only the OUTERMOST offender so
  //    the fixer sees the root cause, not dozens of inherited symptoms.
  const overflowsViewport = (e: ElementSnapshot) =>
    e.rect.x < -OVERFLOW_TOL || e.rect.x + e.rect.w > vw + OVERFLOW_TOL;
  const overflowIds = new Set(visible.filter(overflowsViewport).map(e => e.id));
  for (const e of visible) {
    if (!overflowIds.has(e.id)) continue;
    // Skip if a collected ancestor also overflows (this element is inheriting it).
    if (e.ancestors.some(a => overflowIds.has(a))) continue;
    out.push({
      type: 'element-overflow',
      severity: 'medium',
      page,
      viewport,
      selector: e.selector,
      detail: `Element extends outside the viewport (left ${Math.round(e.rect.x)}px, right ${Math.round(
        e.rect.x + e.rect.w,
      )}px, viewport ${vw}px). Its children overflow with it.`,
      measurements: { left: e.rect.x, right: e.rect.x + e.rect.w, viewport: vw },
    });
  }

  // 3. Text clipped by its own container — but NOT deliberate truncation
  //    (ellipsis or line-clamp are intentional and fine).
  for (const e of visible) {
    const intentionalTruncation =
      e.textOverflow === 'ellipsis' ||
      (e.lineClamp !== 'none' && e.lineClamp !== '') ||
      e.display.includes('-webkit-box');
    if (
      !intentionalTruncation &&
      (e.overflowX === 'hidden' || e.overflowX === 'clip') &&
      e.scrollW > e.clientW + OVERFLOW_TOL &&
      e.hasText
    ) {
      out.push({
        type: 'clipped-text',
        severity: 'medium',
        page,
        viewport,
        selector: e.selector,
        detail: `Content is clipped: scrollWidth ${e.scrollW}px exceeds visible width ${e.clientW}px with overflow hidden (no ellipsis/line-clamp).`,
        measurements: { scrollWidth: e.scrollW, clientWidth: e.clientW },
      });
    }
  }

  // 4. Zero-size elements that still carry text content.
  for (const e of snap.elements) {
    if (e.display !== 'none' && e.hasText && (e.rect.w === 0 || e.rect.h === 0)) {
      out.push({
        type: 'zero-size',
        severity: 'medium',
        page,
        viewport,
        selector: e.selector,
        detail: `Element has content but renders at ${Math.round(e.rect.w)}x${Math.round(
          e.rect.h,
        )}px (collapsed).`,
        measurements: { width: e.rect.w, height: e.rect.h },
      });
    }
  }

  // 5. Overlap between content blocks. Heavily constrained to avoid false
  //    positives: skip positioned/inline, ancestor-descendant pairs, and
  //    inline items sharing a line.
  const overlapCandidates = visible.filter(e => !isPositioned(e) && !isInline(e));
  const seen = new Set<string>();
  for (let i = 0; i < overlapCandidates.length; i++) {
    for (let j = i + 1; j < overlapCandidates.length; j++) {
      const a = overlapCandidates[i];
      const b = overlapCandidates[j];
      // ancestor/descendant → not an overlap, just containment
      if (a.ancestors.includes(b.id) || b.ancestors.includes(a.id)) continue;
      const { ox, oy } = intersect(a, b);
      if (ox <= OVERLAP_MIN || oy <= OVERLAP_MIN) continue;
      // inline-ish items on the same visual line: skip
      if (Math.abs(a.rect.y - b.rect.y) < SAME_LINE_TOL && (isInline(a) || isInline(b))) continue;
      const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        type: 'overlap',
        severity: 'high',
        page,
        viewport,
        selector: `${a.selector}  ⟷  ${b.selector}`,
        detail: `Two content elements visually overlap by ${Math.round(ox)}x${Math.round(
          oy,
        )}px. They should not intersect.`,
        measurements: { overlapX: ox, overlapY: oy },
      });
    }
  }

  return out;
}

// The collector is injected via addInitScript so page.evaluate can call it.
// We register it by stringifying the function into the page context.
async function registerCollector(page: import('playwright').Page) {
  // tsx/esbuild wraps named functions with a `__name` helper for stack traces.
  // When we stringify and inject the collector, that helper is undefined in the
  // page, so shim it to identity before defining the collector.
  await page.addInitScript(
    `window.__name = window.__name || function (f) { return f; };
     window.__collect = ${collectSnapshot.toString()};`,
  );
}

// Collapse identical violations (same page/viewport/type/selector/detail) into
// one entry with an occurrence count. Many sibling cards overflowing for the
// same reason should read as a single actionable item, not N copies.
function dedupe(violations: Violation[]): Violation[] {
  const map = new Map<string, Violation>();
  for (const v of violations) {
    const key = `${v.page}|${v.viewport}|${v.type}|${v.selector}|${v.detail}`;
    const existing = map.get(key);
    if (existing) {
      existing.occurrences = (existing.occurrences || 1) + 1;
    } else {
      map.set(key, { ...v, occurrences: 1 });
    }
  }
  return Array.from(map.values());
}

function buildReport(pages: string[], rawViolations: Violation[]): LayoutReport {
  const violations = dedupe(rawViolations);
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const v of violations) {
    byType[v.type] = (byType[v.type] || 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    pagesChecked: pages,
    viewports: VIEWPORTS.map(v => v.name),
    total: violations.length,
    byType,
    bySeverity,
    violations,
  };
}

// --- CLI ---

async function main() {
  const jsonFlag = process.argv.includes('--json');
  const report = await analyzeLayout();

  const outPath = path.join(CONFIG.testOutputDir, 'layout-report.json');
  fs.mkdirSync(CONFIG.testOutputDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  if (jsonFlag) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Layout Geometry Report`);
    console.log(`Pages: ${report.pagesChecked.length} | Viewports: ${report.viewports.join(', ')}`);
    console.log(`Total violations: ${report.total}`);
    console.log(`  By severity: ${JSON.stringify(report.bySeverity)}`);
    console.log(`  By type:     ${JSON.stringify(report.byType)}`);
    if (report.violations.length > 0) {
      console.log(`\nViolations:`);
      for (const v of report.violations) {
        const times = v.occurrences && v.occurrences > 1 ? ` (×${v.occurrences})` : '';
        console.log(`  [${v.severity.toUpperCase()}] ${v.type} — ${v.page} @ ${v.viewport}${times}`);
        console.log(`      ${v.selector}`);
        console.log(`      ${v.detail}`);
      }
    }
    console.log(`\nReport written to ${outPath}`);
  }

  const highCount = report.bySeverity['high'] || 0;
  process.exit(highCount > 0 ? 1 : 0);
}

// Public API: render every page across viewports, collect geometry, classify.
// Used by both the CLI and the layout-QA orchestrator.
export async function analyzeLayout(
  pages: string[] = [...CONFIG.pagesToCheck],
  port = 4188,
): Promise<LayoutReport> {
  const { chromium } = await import('playwright');
  let server: ChildProcess | null = null;
  const violations: Violation[] = [];
  try {
    server = startServer(port);
    if (!(await waitForServer(port))) throw new Error(`Server failed on port ${port}`);
    // CI installs the bundled Chromium; locally (or on unsupported distros) set
    // PLAYWRIGHT_CHROME_CHANNEL=chrome to use a system Chrome install instead.
    const channel = process.env.PLAYWRIGHT_CHROME_CHANNEL;
    const browser = await chromium.launch({
      headless: true,
      ...(channel ? { channel } : {}),
    });
    try {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        for (const pagePath of pages) {
          const pg = await context.newPage();
          await registerCollector(pg);
          try {
            const resp = await pg.goto(`http://localhost:${port}${pagePath}`, {
              waitUntil: 'networkidle',
              timeout: 15_000,
            });
            if (!resp || resp.status() !== 200) continue;
            await pg.waitForTimeout(400);
            const snap = (await pg.evaluate(
              ([c, e]) => (window as any).__collect(c, e),
              [CONTENT_SELECTORS, EXCLUDE_SELECTORS],
            )) as PageSnapshot;
            violations.push(...classifyPage(pagePath, vp.name, snap));
          } catch (err) {
            violations.push({
              type: 'page-overflow',
              severity: 'low',
              page: pagePath,
              viewport: vp.name,
              selector: 'html',
              detail: `Geometry check error: ${err instanceof Error ? err.message : String(err)}`,
            });
          } finally {
            await pg.close();
          }
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    killServer(server);
  }
  return buildReport(pages, violations);
}

const isMain = process.argv[1]?.endsWith('layout-geometry.ts');
if (isMain) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
