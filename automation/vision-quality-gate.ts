import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

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

const VISION_SCORING_PROMPT = `You are a senior design critic reviewing screenshots of a personal tech blog (sreeraj.dev). Score the design on a 1-10 scale across these dimensions:

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

**Color Harmony (1-10)**
- Is the palette restrained (1 accent, neutral system)?
- Do colors complement each other?
- Is accent used purposefully (interactive elements only)?
- Is contrast sufficient for all text?
- 1-3: clashing or no-effort palette. 4-6: safe but unremarkable. 7-8: harmonious and intentional. 9-10: striking and refined.

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
- Pure black (#000) on pure white (#fff) → deduct 2 from colorHarmony
- Generic "blog template" look → deduct 2 from visualHierarchy
- Uniform card grid with no featured content → deduct 1 from visualHierarchy
- Inconsistent element styles across pages → deduct 2 from cohesion
- Cluttered layout with no whitespace → deduct 2 from spacing
- Text that appears hard to read → deduct 3 from typography

## Reference Quality Bar
Think about these sites as 8-9/10 benchmarks:
- stripe.com (typography, spacing, scroll design)
- linear.app (minimal with perfect interactions)
- vercel.com (clean layout, type hierarchy)
- rauno.me (personal site with exceptional craft)

A personal blog doesn't need to match these exactly, but should aspire to their level of care and intentionality.

## Response Format
Return ONLY valid JSON (no markdown fences, no explanation):
{
  "typography": <number>,
  "spacing": <number>,
  "colorHarmony": <number>,
  "visualHierarchy": <number>,
  "polish": <number>,
  "cohesion": <number>,
  "overall": <number>,
  "issues": ["<specific problem 1>", "<specific problem 2>"],
  "strengths": ["<what works well 1>", "<what works well 2>"],
  "recommendation": "accept" | "reject" | "marginal"
}

The "overall" score should be a weighted average emphasizing typography and visual hierarchy (they matter most for a blog). Set "recommendation" to "accept" if overall >= THRESHOLD, "reject" if overall < THRESHOLD - 1, "marginal" if in between.`;

// --- Core evaluation ---

export async function evaluateVisualQuality(
  screenshotDir: string,
  threshold?: number,
): Promise<VisionResult> {
  const minScore = threshold ?? CONFIG.visionThreshold;

  const screenshots = fs.readdirSync(screenshotDir)
    .filter(f => f.endsWith('.png'))
    .slice(0, CONFIG.visionMaxScreenshots);

  if (screenshots.length === 0) {
    return {
      passed: false,
      score: emptyScore('No screenshots found'),
      screenshotsEvaluated: 0,
    };
  }

  const imageBlocks: Anthropic.ImageBlockParam[] = screenshots.map(file => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: fs.readFileSync(path.join(screenshotDir, file)).toString('base64'),
    },
  }));

  const textBlock: Anthropic.TextBlockParam = {
    type: 'text' as const,
    text: `Here are ${screenshots.length} screenshots of a personal tech blog. The pages shown are: ${screenshots.map(f => f.replace('.png', '').replace(/_/g, '/')).join(', ')}.\n\nThe acceptance threshold is ${minScore}/10. Score this design.`,
  };

  const client = new Anthropic();

  const response = await client.messages.create({
    model: CONFIG.visionModel,
    max_tokens: 2048,
    system: VISION_SCORING_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, textBlock],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

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
      recommendation: parsed.recommendation ?? (parsed.overall >= minScore ? 'accept' : 'reject'),
    };

    return {
      passed: score.overall >= minScore,
      score,
      screenshotsEvaluated: screenshots.length,
    };
  } catch {
    console.error('Failed to parse vision response:', text.slice(0, 500));
    return {
      passed: false,
      score: emptyScore('Failed to parse AI response'),
      screenshotsEvaluated: screenshots.length,
    };
  }
}

// --- Feedback-aware evaluation (for multi-pass loop) ---

export async function evaluateWithFeedback(
  screenshotDir: string,
  previousIssues: string[],
  passNumber: number,
  threshold?: number,
): Promise<VisionResult> {
  const minScore = threshold ?? CONFIG.visionThreshold;

  const screenshots = fs.readdirSync(screenshotDir)
    .filter(f => f.endsWith('.png'))
    .slice(0, CONFIG.visionMaxScreenshots);

  if (screenshots.length === 0) {
    return {
      passed: false,
      score: emptyScore('No screenshots found'),
      screenshotsEvaluated: 0,
    };
  }

  const imageBlocks: Anthropic.ImageBlockParam[] = screenshots.map(file => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: fs.readFileSync(path.join(screenshotDir, file)).toString('base64'),
    },
  }));

  const feedbackContext = previousIssues.length > 0
    ? `\n\nThis is evaluation pass ${passNumber}. Previous issues that should have been fixed:\n${previousIssues.map(i => `- ${i}`).join('\n')}\n\nPay special attention to whether these issues were addressed.`
    : '';

  const textBlock: Anthropic.TextBlockParam = {
    type: 'text' as const,
    text: `Here are ${screenshots.length} screenshots of a personal tech blog. Pages: ${screenshots.map(f => f.replace('.png', '').replace(/_/g, '/')).join(', ')}.\n\nAcceptance threshold: ${minScore}/10.${feedbackContext}\n\nScore this design.`,
  };

  const client = new Anthropic();

  const response = await client.messages.create({
    model: CONFIG.visionModel,
    max_tokens: 2048,
    system: VISION_SCORING_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, textBlock],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

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
      recommendation: parsed.recommendation ?? (parsed.overall >= minScore ? 'accept' : 'reject'),
    };

    return {
      passed: score.overall >= minScore,
      score,
      screenshotsEvaluated: screenshots.length,
    };
  } catch {
    console.error('Failed to parse vision response:', text.slice(0, 500));
    return {
      passed: false,
      score: emptyScore('Failed to parse AI response'),
      screenshotsEvaluated: screenshots.length,
    };
  }
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
