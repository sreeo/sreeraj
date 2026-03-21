import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { DesignTrend } from './trend-registry.js';

const client = new Anthropic();

function loadPrompt(filename: string): string {
  return fs.readFileSync(path.join(CONFIG.promptsDir, filename), 'utf-8');
}

export interface GenerationResult {
  css: string;
  manifest: DesignManifest;
  additionalFonts: string[];
}

export interface DesignManifest {
  month: string;
  trend: string;
  trendId: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  fonts: string[];
  keyFeatures: string[];
}

export async function generateDesign(
  trend: DesignTrend,
  previousTrend: string | null
): Promise<GenerationResult> {
  const systemPrompt = loadPrompt('system-prompt.md');
  const cssContract = loadPrompt('css-contract.md');

  const now = new Date();
  const monthLabel = `${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}`;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const userPrompt = `You are redesigning sreeraj.dev for ${monthLabel}.

## Design Style: ${trend.name}
**What this style is:** ${trend.description}
**Structure & Layout:** ${trend.structure}
**Typography System:** ${trend.typography}
**Spacing & Rhythm:** ${trend.spacing}
**Interactions & Motion:** ${trend.interactions}
**Reference sites:** ${trend.references}

${previousTrend ? `**Previous month's design was: ${previousTrend}. This month should feel structurally different.**` : ''}

${cssContract}

## CRITICAL REMINDERS
- Return ONLY the raw CSS. No markdown fences. No explanations.
- Start with \`@import "tailwindcss";\`
- Include the \`@theme { }\` block with ALL required custom properties
- Define styles for BOTH \`[data-theme="tech"]\` and \`[data-theme="trek"]\` — use the SAME design language for both, only vary the color palette
- The design must faithfully capture the structural DNA of ${trend.name}
- READABILITY IS PARAMOUNT — body text must be effortless to read
- If you want additional Google Fonts, add a comment on line 2: /* FONTS: FontName1, FontName2 */
- ALL hex colors must be in the @theme block only — selectors reference vars
- Include at least 3 @keyframes animations that serve the design language
- Include @media (prefers-reduced-motion: reduce) to disable animations
- Include responsive breakpoints at 640px and 768px`;

  console.log(`Generating ${trend.name} design for ${monthLabel}...`);

  const response = await client.messages.create({
    model: CONFIG.model,
    max_tokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  let cssContent = (response.content[0] as { type: string; text: string }).text.trim();

  // Strip markdown code fences if the model wrapped the output
  cssContent = cssContent.replace(/^```(?:css)?\n?/, '').replace(/\n?```$/, '').trim();

  // Check for truncated output — fix mismatched braces
  cssContent = fixTruncatedCss(cssContent);

  // Extract additional fonts from comment
  const fontMatch = cssContent.match(/\/\*\s*FONTS:\s*(.+?)\s*\*\//);
  const additionalFonts = fontMatch
    ? fontMatch[1].split(',').map(f => f.trim()).filter(Boolean)
    : [];

  // Generate manifest
  const manifest = await generateManifest(trend, monthKey, cssContent);

  return {
    css: cssContent,
    manifest: {
      ...manifest,
      fonts: ['Inter', 'JetBrains Mono', 'Lora', ...additionalFonts],
    },
    additionalFonts,
  };
}

async function generateManifest(
  trend: DesignTrend,
  monthKey: string,
  css: string
): Promise<DesignManifest> {
  // Extract primary color from CSS @theme block
  const accentMatch = css.match(/--color-accent:\s*(#[0-9a-fA-F]{3,8})/);
  const primaryColor = accentMatch ? accentMatch[1] : '#000000';

  const techBgMatch = css.match(/--color-tech-bg:\s*(#[0-9a-fA-F]{3,8})/);
  const accentColor = techBgMatch ? techBgMatch[1] : '#ffffff';

  return {
    month: monthKey,
    trend: trend.name,
    trendId: trend.id,
    description: trend.description,
    primaryColor,
    accentColor,
    fonts: [],
    keyFeatures: [trend.structure.split('.')[0], trend.typography.split('.')[0], trend.interactions.split('.')[0]],
  };
}

/**
 * Fix CSS that was truncated by token limits.
 * Ensures all braces are balanced by appending closing braces as needed.
 * Also removes any incomplete rule at the end (partial selector or property).
 */
function fixTruncatedCss(css: string): string {
  let openBraces = 0;

  for (const char of css) {
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
  }

  if (openBraces > 0) {
    console.log(`  Fixing truncated CSS: ${openBraces} unclosed brace(s)`);

    // Find the last complete rule (ends with })
    const lastCloseBrace = css.lastIndexOf('}');
    if (lastCloseBrace > 0) {
      // Trim everything after the last complete rule
      css = css.substring(0, lastCloseBrace + 1);

      // Recount
      openBraces = 0;
      for (const char of css) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
      }
    }

    // Append remaining closing braces
    css += '\n' + '}'.repeat(openBraces);
  }

  return css;
}

// Allow standalone execution for testing
if (process.argv[1]?.endsWith('design-generator.ts')) {
  const trendArg = process.argv.find(a => a.startsWith('--trend='));
  if (trendArg) {
    const { TRENDS } = await import('./trend-registry.js');
    const trendId = trendArg.split('=')[1];
    const trend = TRENDS.find(t => t.id === trendId);
    if (!trend) {
      console.error(`Unknown trend: ${trendId}. Available: ${TRENDS.map(t => t.id).join(', ')}`);
      process.exit(1);
    }
    const result = await generateDesign(trend, null);
    console.log('--- Generated CSS ---');
    console.log(result.css);
    console.log('\n--- Manifest ---');
    console.log(JSON.stringify(result.manifest, null, 2));
  }
}
