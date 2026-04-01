import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import type { VisionScore } from './vision-quality-gate.js';

export interface ValidationResult {
  passed: boolean;
  steps: StepResult[];
  visionScore?: VisionScore;
}

interface StepResult {
  name: string;
  passed: boolean;
  message: string;
}

// Critical selectors — must be present for the site to function
const CRITICAL_SELECTORS = [
  '@theme',
  'tailwindcss',
  'data-theme="tech"',
  'data-theme="trek"',
  'nav-bar',
  'nav-brand',
  'nav-link',
  'post-card',
  'tag-pill',
  'section-title',
  'site-footer',
  '.prose',
  'git-log-timeline',
  'gl-entry',
  'gl-hash',
  'gl-msg',
  'cursor-blink',
  '@keyframes',
];

// Important but non-blocking selectors
const RECOMMENDED_SELECTORS = [
  'post-header-title',
  'post-header-meta',
  'page-title',
  'page-description',
  'trek-prose',
  'trek-journal',
  'trek-hero-wrap',
  'gl-tag',
  'gl-date',
  'reduced-motion',
  'post-card-title',
  'post-card-meta',
  'post-card-description',
  'kg-bookmark',
  'post-nav-link',
  'post-nav-border',
];

// --- Server management helpers ---

function startServer(port: number): ChildProcess {
  const server = spawn('npx', ['serve', 'dist', '-l', String(port), '--no-clipboard'], {
    cwd: CONFIG.projectRoot,
    stdio: 'pipe',
    detached: false,
  });
  // Prevent unhandled error from crashing the process
  server.on('error', () => {});
  return server;
}

function killServer(server: ChildProcess | null): void {
  if (!server || server.killed) return;
  try {
    server.kill('SIGKILL');
  } catch {
    // already dead
  }
}

async function waitForServer(port: number, timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

// --- Main validation ---

export async function validateDesign(css: string): Promise<ValidationResult> {
  const steps: StepResult[] = [];

  // Step 1: CSS Contract Check
  console.log('Step 1: CSS contract check...');
  const contractResult = checkCssContract(css);
  steps.push(contractResult);
  if (!contractResult.passed) {
    return { passed: false, steps };
  }

  // Step 1b: Contrast Check
  console.log('Step 1b: Contrast check...');
  const contrastResult = checkContrast(css);
  steps.push(contrastResult);
  if (!contrastResult.passed) {
    return { passed: false, steps };
  }

  // Step 2: Build Check
  console.log('Step 2: Build check...');
  const buildResult = await checkBuild();
  steps.push(buildResult);
  if (!buildResult.passed) {
    return { passed: false, steps };
  }

  // Step 3: Page Render Check (Playwright)
  console.log('Step 3: Page render check...');
  const renderResult = await checkPageRenders();
  steps.push(renderResult);
  if (!renderResult.passed) {
    return { passed: false, steps };
  }

  // Step 4: Visual Sanity Check
  console.log('Step 4: Visual sanity check...');
  const visualResult = await checkVisualSanity();
  steps.push(visualResult);
  if (!visualResult.passed) {
    return { passed: false, steps };
  }

  // Step 5: Accessibility Check
  console.log('Step 5: Accessibility check...');
  const a11yResult = await checkAccessibility();
  steps.push(a11yResult);
  if (!a11yResult.passed) {
    console.log('  Warning: accessibility issues found (non-blocking)');
  }

  // Step 6: Font Check
  console.log('Step 6: Font check...');
  const fontResult = await checkFonts(css);
  steps.push(fontResult);

  // Step 7: Vision Quality Gate
  let visionScore: VisionScore | undefined;
  if (CONFIG.visionEnabled) {
    console.log('Step 7: Vision quality check...');
    const visionResult = await checkVisionQuality();
    steps.push(visionResult);
    if (visionResult.visionScore) {
      visionScore = visionResult.visionScore;
    }
  }

  // Steps 0-4 (contract, contrast, build, render, visual) are critical
  // Step 5 (a11y) and Step 6 (fonts) are non-blocking
  // Step 7 (vision) is critical when enabled
  const criticalPassed = steps
    .filter((_, i) => i < 5)
    .every(s => s.passed);

  const visionPassed = !CONFIG.visionEnabled || steps.find(s => s.name === 'Vision Quality')?.passed !== false;

  return { passed: criticalPassed && visionPassed, steps, visionScore };
}

// --- Contrast checks ---

function hexToRgb(hex: string): [number, number, number] | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = luminance(...rgb1);
  const l2 = luminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast(css: string): StepResult {
  const issues: string[] = [];
  const extractColor = (varName: string): string | null => {
    const match = css.match(new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(#[0-9a-fA-F]{3,8})`));
    return match ? match[1] : null;
  };

  const pairs = [
    { name: 'tech text/bg', fg: extractColor('--color-tech-text'), bg: extractColor('--color-tech-bg'), minRatio: 4.5 },
    { name: 'tech muted/bg', fg: extractColor('--color-tech-text-muted'), bg: extractColor('--color-tech-bg'), minRatio: 3.0 },
    { name: 'trek text/bg', fg: extractColor('--color-trek-text'), bg: extractColor('--color-trek-bg'), minRatio: 4.5 },
    { name: 'trek muted/bg', fg: extractColor('--color-trek-text-muted'), bg: extractColor('--color-trek-bg'), minRatio: 3.0 },
  ];

  for (const pair of pairs) {
    if (!pair.fg || !pair.bg) { issues.push(`${pair.name}: could not extract colors`); continue; }
    const ratio = contrastRatio(pair.fg, pair.bg);
    if (ratio === null) { issues.push(`${pair.name}: invalid color format`); continue; }
    if (ratio < pair.minRatio) {
      issues.push(`${pair.name}: contrast ratio ${ratio.toFixed(1)}:1 (need ${pair.minRatio}:1) — ${pair.fg} on ${pair.bg}`);
    }
  }

  if (issues.length > 0) {
    return { name: 'Contrast', passed: false, message: `Readability issues:\n  ${issues.join('\n  ')}` };
  }
  return { name: 'Contrast', passed: true, message: 'All text/background color pairs meet minimum contrast ratios' };
}

// --- CSS contract ---

function checkCssContract(css: string): StepResult {
  const missingCritical: string[] = [];
  const missingRecommended: string[] = [];

  for (const selector of CRITICAL_SELECTORS) {
    if (!css.includes(selector)) missingCritical.push(selector);
  }
  for (const selector of RECOMMENDED_SELECTORS) {
    if (!css.includes(selector)) missingRecommended.push(selector);
  }

  const techCount = (css.match(/\[data-theme="tech"\]/g) || []).length;
  const trekCount = (css.match(/\[data-theme="trek"\]/g) || []).length;
  if (techCount < 8) missingCritical.push(`tech theme has only ${techCount} selectors (need 8+)`);
  if (trekCount < 8) missingCritical.push(`trek theme has only ${trekCount} selectors (need 8+)`);

  const keyframesCount = (css.match(/@keyframes/g) || []).length;
  if (keyframesCount < 2) missingCritical.push(`only ${keyframesCount} @keyframes (need 2+)`);

  if (missingCritical.length > 0) {
    return { name: 'CSS Contract', passed: false, message: `Missing critical: ${missingCritical.join(', ')}` };
  }

  const warnings = missingRecommended.length > 0 ? ` Warnings: missing ${missingRecommended.join(', ')}` : '';
  return {
    name: 'CSS Contract',
    passed: true,
    message: `All critical selectors present. Tech: ${techCount}, Trek: ${trekCount}, Animations: ${keyframesCount}.${warnings}`,
  };
}

// --- Build check ---

async function checkBuild(): Promise<StepResult> {
  try {
    const result = execSync('npm run build 2>&1', {
      cwd: CONFIG.projectRoot,
      encoding: 'utf-8',
      timeout: 120_000,
    });

    const indexPath = path.join(CONFIG.projectRoot, 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      return { name: 'Build', passed: false, message: `Build ran but dist/index.html not found.\nOutput: ${result.slice(-500)}` };
    }
    return { name: 'Build', passed: true, message: 'Build succeeded, dist/index.html exists' };
  } catch (error) {
    const output = (error as { stdout?: string; stderr?: string });
    const combined = (output.stdout || '') + '\n' + (output.stderr || '');
    return { name: 'Build', passed: false, message: `Build failed:\n${combined.slice(-500)}` };
  }
}

// --- Page render check (Playwright) ---

async function checkPageRenders(): Promise<StepResult> {
  let server: ChildProcess | null = null;
  try {
    const { chromium } = await import('playwright');

    server = startServer(4173);
    const ready = await waitForServer(4173);
    if (!ready) {
      killServer(server);
      return { name: 'Page Render', passed: false, message: 'Server failed to start on port 4173' };
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    const screenshotDir = CONFIG.testOutputDir;
    fs.mkdirSync(screenshotDir, { recursive: true });

    for (const pagePath of CONFIG.pagesToCheck) {
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      try {
        const response = await page.goto(`http://localhost:4173${pagePath}`, {
          waitUntil: 'networkidle',
          timeout: 15_000,
        });

        if (!response || response.status() !== 200) {
          errors.push(`${pagePath}: HTTP ${response?.status() || 'no response'}`);
          continue;
        }

        const hasMain = await page.$('main');
        if (!hasMain) errors.push(`${pagePath}: missing <main> element`);

        const screenshotName = pagePath === '/' ? 'index' : pagePath.replace(/\//g, '_');
        await page.screenshot({
          path: path.join(screenshotDir, `${screenshotName}.png`),
          fullPage: false,
        });

        if (consoleErrors.length > 0) {
          errors.push(`${pagePath}: console errors: ${consoleErrors.join('; ')}`);
        }
      } catch (err) {
        errors.push(`${pagePath}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await page.close();
      }
    }

    await browser.close();
    killServer(server);

    if (errors.length > 0) {
      return { name: 'Page Render', passed: false, message: errors.join('\n') };
    }
    return { name: 'Page Render', passed: true, message: `All ${CONFIG.pagesToCheck.length} pages rendered successfully` };
  } catch (error) {
    killServer(server);
    return { name: 'Page Render', passed: false, message: `Playwright error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// --- Visual sanity ---

async function checkVisualSanity(): Promise<StepResult> {
  const screenshotDir = CONFIG.testOutputDir;
  if (!fs.existsSync(screenshotDir)) {
    return { name: 'Visual Sanity', passed: false, message: 'No screenshots to check' };
  }

  const screenshots = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
  if (screenshots.length === 0) {
    return { name: 'Visual Sanity', passed: false, message: 'No screenshots found' };
  }

  const issues: string[] = [];
  for (const file of screenshots) {
    const stats = fs.statSync(path.join(screenshotDir, file));
    if (stats.size < 5000) {
      issues.push(`${file}: suspiciously small (${stats.size} bytes) — may be blank`);
    }
  }

  if (issues.length > 0) {
    return { name: 'Visual Sanity', passed: false, message: issues.join('\n') };
  }
  return { name: 'Visual Sanity', passed: true, message: `${screenshots.length} screenshots look valid` };
}

// --- Accessibility ---

async function checkAccessibility(): Promise<StepResult> {
  let server: ChildProcess | null = null;
  try {
    const { chromium } = await import('playwright');
    const AxeBuilder = (await import('@axe-core/playwright')).default;

    server = startServer(4174);
    const ready = await waitForServer(4174);
    if (!ready) {
      killServer(server);
      return { name: 'Accessibility', passed: true, message: 'Skipped: server failed to start' };
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle', timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    await browser.close();
    killServer(server);

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      const summary = criticalViolations
        .map(v => `${v.impact}: ${v.description} (${v.nodes.length} instances)`)
        .join('\n');
      return { name: 'Accessibility', passed: false, message: summary };
    }

    return {
      name: 'Accessibility',
      passed: true,
      message: `Passed. ${results.violations.length} minor issues, ${results.passes.length} rules passed`,
    };
  } catch (error) {
    killServer(server);
    return {
      name: 'Accessibility',
      passed: true,
      message: `Could not run a11y check: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// --- Font check ---

async function checkFonts(css: string): Promise<StepResult> {
  const fontMatch = css.match(/\/\*\s*FONTS:\s*(.+?)\s*\*\//);
  if (!fontMatch) {
    return { name: 'Font Check', passed: true, message: 'No additional fonts specified' };
  }

  const fonts = fontMatch[1].split(',').map(f => f.trim());
  const issues: string[] = [];

  for (const font of fonts) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) issues.push(`${font}: Google Fonts returned ${response.status}`);
    } catch {
      issues.push(`${font}: failed to reach Google Fonts`);
    }
  }

  if (issues.length > 0) {
    return { name: 'Font Check', passed: false, message: issues.join(', ') };
  }
  return { name: 'Font Check', passed: true, message: `Fonts verified: ${fonts.join(', ')}` };
}

// --- Vision quality gate ---

interface VisionStepResult extends StepResult {
  visionScore?: VisionScore;
}

async function checkVisionQuality(): Promise<VisionStepResult> {
  try {
    const { evaluateVisualQuality } = await import('./vision-quality-gate.js');
    const result = await evaluateVisualQuality(CONFIG.testOutputDir);
    const s = result.score;

    const details = [
      `Overall: ${s.overall}/10`,
      `Typography: ${s.typography}`,
      `Spacing: ${s.spacing}`,
      `Color: ${s.colorHarmony}`,
      `Hierarchy: ${s.visualHierarchy}`,
      `Polish: ${s.polish}`,
      `Cohesion: ${s.cohesion}`,
      `Recommendation: ${s.recommendation}`,
    ].join(', ');

    if (s.issues.length > 0) {
      console.log(`  Issues: ${s.issues.join('; ')}`);
    }

    return {
      name: 'Vision Quality',
      passed: result.passed,
      message: result.passed
        ? `Passed (${details})`
        : `Below threshold (${details})`,
      visionScore: s,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Vision gate failure is non-fatal if API is unavailable
    if (msg.includes('ANTHROPIC_API_KEY') || msg.includes('401') || msg.includes('fetch')) {
      return {
        name: 'Vision Quality',
        passed: true,
        message: `Skipped: ${msg}`,
      };
    }
    return {
      name: 'Vision Quality',
      passed: false,
      message: `Vision evaluation error: ${msg}`,
    };
  }
}

// --- Archive verification (called by orchestrator after archiving) ---

export async function validateArchive(monthKey: string): Promise<StepResult> {
  let server: ChildProcess | null = null;
  try {
    const { chromium } = await import('playwright');

    server = startServer(4175);
    const ready = await waitForServer(4175);
    if (!ready) {
      killServer(server);
      return { name: 'Archive Verification', passed: false, message: 'Server failed to start' };
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const archiveUrl = `http://localhost:4175/archive/${monthKey}/`;
    const response = await page.goto(archiveUrl, { waitUntil: 'networkidle', timeout: 15_000 });

    if (!response || response.status() !== 200) {
      await browser.close();
      killServer(server);
      return { name: 'Archive Verification', passed: false, message: `Archive returned HTTP ${response?.status() || 'no response'}` };
    }

    const hasStyledNav = await page.$('.nav-bar');
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const stylesheetCount = await page.evaluate(() => document.querySelectorAll('link[rel="stylesheet"]').length);

    const screenshotDir = CONFIG.testOutputDir;
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `archive-${monthKey}.png`), fullPage: false });

    await browser.close();
    killServer(server);

    const isUnstyled = bodyBg === 'rgb(255, 255, 255)' || bodyBg === 'rgba(0, 0, 0, 0)';

    if (!hasStyledNav || isUnstyled) {
      return {
        name: 'Archive Verification',
        passed: false,
        message: `Archive appears unstyled. Nav: ${!!hasStyledNav}, BG: ${bodyBg}, Stylesheets: ${stylesheetCount}`,
      };
    }

    return {
      name: 'Archive Verification',
      passed: true,
      message: `Archive ${monthKey} loads correctly. BG: ${bodyBg}, Stylesheets: ${stylesheetCount}`,
    };
  } catch (error) {
    killServer(server);
    return {
      name: 'Archive Verification',
      passed: false,
      message: `Archive check error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
