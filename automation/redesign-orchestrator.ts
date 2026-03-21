import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CONFIG } from './config.js';
import { selectTrend, getLastTrend, DesignLog, DesignLogEntry, TRENDS } from './trend-registry.js';
import { generateDesign } from './design-generator.js';
import { discoverTrend } from './trend-discovery.js';
import { validateDesign, validateArchive } from './validate-design.js';
import { archiveCurrentDesign } from './archive-manager.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_TREND = process.argv.find(a => a.startsWith('--trend='))?.split('=')[1];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Monthly Redesign Orchestrator`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no commit/push)' : 'LIVE'}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  // Load design log
  const designLog: DesignLog = fs.existsSync(CONFIG.designLogPath)
    ? JSON.parse(fs.readFileSync(CONFIG.designLogPath, 'utf-8'))
    : { designs: [] };

  const previousTrend = getLastTrend(designLog);

  // Back up current CSS
  const originalCss = fs.readFileSync(CONFIG.globalCssPath, 'utf-8');

  let attempt = 0;
  const maxAttempts = CONFIG.maxRetries + 1;
  const triedTrends = new Set<string>();

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\n--- Attempt ${attempt}/${maxAttempts} ---\n`);

    // Select trend
    let trend;
    if (FORCE_TREND && attempt === 1) {
      // Check hardcoded trends first
      const found = TRENDS.find(t => t.id === FORCE_TREND);
      if (found) {
        trend = found;
      } else {
        console.error(`Unknown trend: ${FORCE_TREND}. Available: ${TRENDS.map(t => t.id).join(', ')}`);
        process.exit(1);
      }
    } else if (attempt === 1) {
      // First attempt: use web search + Claude to discover a trend
      try {
        trend = await discoverTrend(designLog, previousTrend);
      } catch (error) {
        console.log(`Trend discovery failed: ${error instanceof Error ? error.message : error}`);
        console.log('Falling back to classic trend registry...');
        trend = selectTrend(designLog);
      }
    } else {
      // Retries: fall back to classic registry
      trend = selectTrend(designLog);
      while (triedTrends.has(trend.id)) {
        trend = selectTrend(designLog);
      }
    }
    triedTrends.add(trend.id);
    console.log(`Selected trend: ${trend.name}`);

    try {
      // Step 1: Generate design
      console.log('\n[1/4] Generating design via Claude API...');
      const result = await generateDesign(trend, previousTrend);
      console.log(`  Generated ${result.css.length} chars of CSS`);
      console.log(`  Additional fonts: ${result.additionalFonts.join(', ') || 'none'}`);

      // Step 2: Apply CSS
      console.log('\n[2/4] Applying generated CSS...');
      fs.writeFileSync(CONFIG.globalCssPath, result.css);

      // Update BaseHead if additional fonts are needed
      if (result.additionalFonts.length > 0) {
        updateFontLinks(result.additionalFonts);
      }

      // Step 3: Validate
      console.log('\n[3/4] Validating design...');
      const validation = await validateDesign(result.css);

      console.log('\nValidation Results:');
      for (const step of validation.steps) {
        const icon = step.passed ? 'PASS' : 'FAIL';
        console.log(`  [${icon}] ${step.name}: ${step.message}`);
      }

      if (!validation.passed) {
        console.log(`\nValidation FAILED. Reverting CSS...`);
        fs.writeFileSync(CONFIG.globalCssPath, originalCss);

        // Log failure
        logDesign(designLog, trend, 'failed');
        continue;
      }

      // Step 4: Archive + commit (skip in dry run)
      if (DRY_RUN) {
        console.log('\n[4/4] DRY RUN — skipping archive and commit.');
        console.log('  Generated CSS is still applied. Review with: npm run preview');
        console.log(`  Screenshots saved to: ${CONFIG.testOutputDir}`);

        // Write current trend for reference
        fs.writeFileSync(
          path.join(CONFIG.testOutputDir, 'manifest.json'),
          JSON.stringify(result.manifest, null, 2)
        );
      } else {
        console.log('\n[4/5] Archiving previous design...');

        // Archive current design before we rebuild with new CSS
        // The current dist/ was built during validation, so we archive that
        await archiveCurrentDesign(result.manifest);

        // Rebuild with new CSS so dist/ includes the archive
        console.log('\n[5/5] Rebuilding with new design + archive...');
        execSync('npm run build', {
          cwd: CONFIG.projectRoot,
          stdio: 'pipe',
          timeout: 120_000,
        });

        // Verify archive is viewable
        console.log('Verifying archive is viewable...');
        const archiveCheck = await validateArchive(result.manifest.month);
        const archiveIcon = archiveCheck.passed ? 'PASS' : 'FAIL';
        console.log(`  [${archiveIcon}] ${archiveCheck.name}: ${archiveCheck.message}`);

        if (!archiveCheck.passed) {
          console.log('  Warning: archive verification failed (non-blocking)');
        }

        // Write manifest
        const dataDir = path.join(CONFIG.projectRoot, 'src', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(
          path.join(dataDir, 'design-manifest.json'),
          JSON.stringify(result.manifest, null, 2)
        );

        // Write current trend name for commit message
        const historyDir = path.dirname(CONFIG.designLogPath);
        fs.writeFileSync(
          path.join(historyDir, 'current-trend.txt'),
          trend.name
        );
      }

      // Log success
      logDesign(designLog, trend, 'success', result.manifest.primaryColor);

      console.log(`\nRedesign complete: ${trend.name}`);
      console.log(`Primary color: ${result.manifest.primaryColor}`);
      process.exit(0);

    } catch (error) {
      console.error(`\nError during attempt ${attempt}:`, error instanceof Error ? error.message : error);
      fs.writeFileSync(CONFIG.globalCssPath, originalCss);
      logDesign(designLog, trend, 'failed');
    }
  }

  // All attempts failed
  console.error(`\nAll ${maxAttempts} attempts failed. Keeping current design.`);
  fs.writeFileSync(CONFIG.globalCssPath, originalCss);
  process.exit(1);
}

function logDesign(
  log: DesignLog,
  trend: { id: string; name: string; description: string },
  status: 'success' | 'failed',
  primaryColor?: string
) {
  const now = new Date();
  const entry: DesignLogEntry = {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    trendId: trend.id,
    trendName: trend.name,
    status,
    timestamp: now.toISOString(),
    description: trend.description,
    primaryColor,
  };

  log.designs.push(entry);
  fs.writeFileSync(CONFIG.designLogPath, JSON.stringify(log, null, 2));
}

function updateFontLinks(additionalFonts: string[]) {
  const baseHeadPath = path.join(CONFIG.projectRoot, 'src', 'components', 'BaseHead.astro');
  if (!fs.existsSync(baseHeadPath)) return;

  let content = fs.readFileSync(baseHeadPath, 'utf-8');

  // Check if there's already a dynamic font link
  const dynamicFontMarker = '<!-- DYNAMIC_FONTS -->';
  const fontFamilies = additionalFonts.map(f => `family=${encodeURIComponent(f)}`).join('&');
  const fontLink = `${dynamicFontMarker}\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?${fontFamilies}&display=swap" rel="stylesheet" />\n<!-- /DYNAMIC_FONTS -->`;

  if (content.includes(dynamicFontMarker)) {
    // Replace existing dynamic fonts
    content = content.replace(
      /<!-- DYNAMIC_FONTS -->[\s\S]*?<!-- \/DYNAMIC_FONTS -->/,
      fontLink
    );
  } else {
    // Insert before closing </head> — find the slot
    content = content.replace('</head>', `${fontLink}\n</head>`);
  }

  fs.writeFileSync(baseHeadPath, content);
  console.log(`  Updated BaseHead.astro with fonts: ${additionalFonts.join(', ')}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
