import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { agentJson } from './agent-query.js';

// --- Types ---

export interface VisionScore {
  overall: number;
  typography: number;
  spacing: number;
  colorHarmony: number;
  visualHierarchy: number;
  polish: number;
  cohesion: number;
  issues: string[];
  strengths: string[];
  recommendation: 'accept' | 'reject' | 'marginal';
}

export interface VisionResult {
  passed: boolean;
  score: VisionScore;
  screenshotsEvaluated: number;
}

// --- Scoring prompt ---

const VISION_SCORING_PROMPT = `You are a senior design critic reviewing screenshots of a personal tech blog (sreeraj.dev). IMPORTANT CONTEXT: this site is deliberately rebuilt in a different visual idiom every month — sometimes minimalist, sometimes brutalist, print-era, teletext, zine, generative. Judge the design ON ITS OWN IDIOM'S TERMS: score how well it commits to and executes its evident style, not how closely it matches contemporary minimalist taste. A flawlessly executed dense Victorian almanac deserves a 9; a tasteful-but-generic SaaS layout deserves a 5. Score on a 1-10 scale across these dimensions:

## Scoring Criteria

**Typography (1-10)**
- Is there a deliberate type scale? Do sizes relate mathematically?
- Are heading weights distinct from body text?
- Is letter-spacing and line-height well-tuned?
- Are meta elements (dates, tags) visually secondary?
- 1-3: random sizes, poor weight usage. 4-6: functional but generic. 7-8: intentional system. 9-10: exceptional craft.

**Spacing & Rhythm (1-10)**
- Is there a consistent spacing scale?
- Do sections have generous vertical padding (not cramped)?
- Is card internal padding comfortable?
- Does the page breathe — or is it cluttered?
- 1-3: random spacing, cramped. 4-6: adequate. 7-8: rhythmic and deliberate. 9-10: mathematical precision.

**Color Intent (1-10)**
- Does the palette serve the idiom — restrained where the style is quiet, orchestrated-polychrome where the style is loud?
- Does every color have a consistent, discernible role?
- Is contrast sufficient for all body text?
- Pure black-on-white, phosphor-on-black, or clashing brights are CORRECT when the idiom calls for them.
- 1-3: accidental or muddled color. 4-6: safe but unremarkable. 7-8: intentional and role-driven. 9-10: the palette IS part of the idiom's argument.

**Visual Hierarchy (1-10)**
- Does the eye flow naturally through the page?
- Is there clear differentiation between primary, secondary, and tertiary content?
- Does the homepage have a distinctive layout (not just a uniform card grid)?
- Are featured or recent posts given visual prominence?
- 1-3: flat, no hierarchy. 4-6: basic hierarchy. 7-8: clear and guided. 9-10: masterful content choreography.

**Polish (1-10)**
- Do interactive elements appear to have hover states (visual affordance)?
- Are borders, shadows, and radii consistent?
- Are images treated consistently (aspect ratios, borders)?
- Does every element feel intentional, not default?
- 1-3: unstyled/default feel. 4-6: styled but rough. 7-8: polished and consistent. 9-10: pixel-perfect.

**Cohesion (1-10)**
- Does every element feel like it belongs to the same design system?
- Is the design language consistent across pages?
- Does the site feel like it was designed by one person with a clear vision?
- 1-3: frankensteined. 4-6: mostly consistent. 7-8: unified system. 9-10: seamless identity.

## Failure Modes (auto-deduct points)
- Generic "blog template" look → deduct 2 from visualHierarchy
- Generic tasteful-SaaS-minimalism when the site evidently attempts a distinctive idiom (half-committed reskin) → deduct 2 from cohesion
- Uniform card grid with no featured content → deduct 1 from visualHierarchy
- Inconsistent element styles across pages → deduct 2 from cohesion
- DISORDERED layout — density is legitimate for dense idioms (terminal, almanac, dashboard), but disorder is not → deduct 2 from spacing
- Body text that appears hard to read → deduct 3 from typography (this one is idiom-independent)

## Reference Quality Bar
The 8-9/10 bar is "the best artifact of the design's own idiom": the sharpest zine spread, the most beautiful topographic map, the most polished terminal UI, stripe.com-level polish for contemporary styles. Ask: would a master OF THIS STYLE nod in approval?

The "overall" score should be a weighted average emphasizing typography and visual hierarchy (they matter most for a blog). Set "recommendation" to "accept" if overall >= the stated threshold, "reject" if overall < threshold - 1, "marginal" if in between.`;

// JSON schema the Agent SDK validates the returned score against.
const VISION_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    typography: { type: 'number' },
    spacing: { type: 'number' },
    colorHarmony: { type: 'number' },
    visualHierarchy: { type: 'number' },
    polish: { type: 'number' },
    cohesion: { type: 'number' },
    overall: { type: 'number' },
    issues: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string', enum: ['accept', 'reject', 'marginal'] },
  },
  required: [
    'typography', 'spacing', 'colorHarmony', 'visualHierarchy',
    'polish', 'cohesion', 'overall', 'recommendation',
  ],
  additionalProperties: false,
} as const;

// --- Core evaluation ---
// Score the screenshots via the Agent SDK (session auth). The agent Reads each
// PNG (which presents it visually) and returns the rubric scores as validated
// JSON — no raw image API call, no ANTHROPIC_API_KEY required.
async function scoreScreenshots(
  screenshotDir: string,
  minScore: number,
  extraContext = '',
): Promise<VisionResult> {
  const screenshots = fs.readdirSync(screenshotDir)
    .filter(f => f.endsWith('.png'))
    .slice(0, CONFIG.visionMaxScreenshots);

  if (screenshots.length === 0) {
    return { passed: false, score: emptyScore('No screenshots found'), screenshotsEvaluated: 0 };
  }

  const paths = screenshots.map(f => path.join(screenshotDir, f));
  const pages = screenshots.map(f => f.replace('.png', '').replace(/_/g, '/')).join(', ');

  // Tell the judge what idiom this month's design declares, so fidelity is
  // scored against the right target rather than generic taste.
  let idiomContext = '';
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(CONFIG.projectRoot, 'src/data/design-manifest.json'), 'utf-8'),
    );
    if (manifest?.trend) {
      idiomContext = `\nDeclared idiom this month: **${manifest.trend}**${manifest.description ? ` — ${manifest.description}` : ''}\nJudge commitment and craft WITHIN this idiom.`;
    }
  } catch {
    /* no manifest — judge from the screenshots alone */
  }

  const prompt = `${VISION_SCORING_PROMPT}

---
${idiomContext}

Use the Read tool on EACH of these ${screenshots.length} screenshot files so you can see them, then score the design. Pages shown: ${pages}.
Acceptance threshold: ${minScore}/10.${extraContext}

Screenshot files:
${paths.map(p => `- ${p}`).join('\n')}`;

  const parsed = await agentJson<Partial<VisionScore>>(prompt, VISION_SCORE_SCHEMA, {
    allowedTools: ['Read'],
    maxTurns: 6,
  });

  if (!parsed) {
    return {
      passed: false,
      score: emptyScore('Agent returned no structured score'),
      screenshotsEvaluated: screenshots.length,
    };
  }

  const score: VisionScore = {
    overall: clamp(parsed.overall ?? 0),
    typography: clamp(parsed.typography ?? 0),
    spacing: clamp(parsed.spacing ?? 0),
    colorHarmony: clamp(parsed.colorHarmony ?? 0),
    visualHierarchy: clamp(parsed.visualHierarchy ?? 0),
    polish: clamp(parsed.polish ?? 0),
    cohesion: clamp(parsed.cohesion ?? 0),
    issues: parsed.issues ?? [],
    strengths: parsed.strengths ?? [],
    recommendation: parsed.recommendation ?? (((parsed.overall ?? 0) >= minScore) ? 'accept' : 'reject'),
  };

  return { passed: score.overall >= minScore, score, screenshotsEvaluated: screenshots.length };
}

export async function evaluateVisualQuality(
  screenshotDir: string,
  threshold?: number,
): Promise<VisionResult> {
  const minScore = threshold ?? CONFIG.visionThreshold;
  return scoreScreenshots(screenshotDir, minScore);
}

// --- Feedback-aware evaluation (for multi-pass loop) ---

export async function evaluateWithFeedback(
  screenshotDir: string,
  previousIssues: string[],
  passNumber: number,
  threshold?: number,
): Promise<VisionResult> {
  const minScore = threshold ?? CONFIG.visionThreshold;
  const feedbackContext = previousIssues.length > 0
    ? `\n\nThis is evaluation pass ${passNumber}. Previous issues that should have been fixed:\n${previousIssues.map(i => `- ${i}`).join('\n')}\n\nPay special attention to whether these issues were addressed.`
    : '';
  return scoreScreenshots(screenshotDir, minScore, feedbackContext);
}

// --- CLI entry point ---

async function main() {
  const dir = process.argv[2] || CONFIG.testOutputDir;
  const jsonFlag = process.argv.includes('--json');

  console.log(`Vision Quality Gate`);
  console.log(`Screenshot dir: ${dir}`);
  console.log(`Threshold: ${CONFIG.visionThreshold}/10\n`);

  const result = await evaluateVisualQuality(dir);

  if (jsonFlag) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const s = result.score;
    console.log(`Screenshots evaluated: ${result.screenshotsEvaluated}`);
    console.log(`\nScores:`);
    console.log(`  Typography:       ${s.typography}/10`);
    console.log(`  Spacing:          ${s.spacing}/10`);
    console.log(`  Color Harmony:    ${s.colorHarmony}/10`);
    console.log(`  Visual Hierarchy: ${s.visualHierarchy}/10`);
    console.log(`  Polish:           ${s.polish}/10`);
    console.log(`  Cohesion:         ${s.cohesion}/10`);
    console.log(`  ────────────────────`);
    console.log(`  Overall:          ${s.overall}/10`);
    console.log(`\nRecommendation: ${s.recommendation}`);

    if (s.strengths.length > 0) {
      console.log(`\nStrengths:`);
      s.strengths.forEach(str => console.log(`  + ${str}`));
    }
    if (s.issues.length > 0) {
      console.log(`\nIssues:`);
      s.issues.forEach(iss => console.log(`  - ${iss}`));
    }

    console.log(`\nResult: ${result.passed ? 'PASSED' : 'FAILED'}`);
  }

  process.exit(result.passed ? 0 : 1);
}

// --- Helpers ---

function clamp(n: number): number {
  return Math.max(0, Math.min(10, Number(n) || 0));
}

function emptyScore(issue: string): VisionScore {
  return {
    overall: 0,
    typography: 0,
    spacing: 0,
    colorHarmony: 0,
    visualHierarchy: 0,
    polish: 0,
    cohesion: 0,
    issues: [issue],
    strengths: [],
    recommendation: 'reject',
  };
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith('vision-quality-gate.ts');
if (isMainModule) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
