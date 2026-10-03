/**
 * Layout fixer — the agent half of the layout QA stage.
 *
 * Given a consolidated list of layout issues (deterministic geometry violations
 * plus any agentic visual findings), it runs the fixer agent (Claude Code or Codex,
 * see pipeline/roles.json) with the layout-qa skill's rules in the prompt, and edits
 * the CSS to resolve them — without touching the approved visual style. The
 * orchestrator drives the build/re-check loop; this module performs one focused fix
 * pass and reports what it changed.
 */
import fs from 'fs';
import path from 'path';
import { runAgent } from './pipeline/agent.js';
import { CONFIG } from './config.js';
import type { Violation } from './layout-geometry.js';

export interface ConsolidatedIssues {
  geometry: Violation[];
  // Free-form findings from the webwright/vision reviewer (selector + problem).
  visual: { source: string; page?: string; problem: string }[];
}

export interface FixSummary {
  filesChanged: string[];
  changes: string;
  notes: string;
}

const FIX_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    changes: { type: 'string', description: 'What was changed and why, concise.' },
    notes: { type: 'string', description: 'Anything unresolved or risky.' },
  },
  required: ['filesChanged', 'changes', 'notes'],
  additionalProperties: false,
} as const;

/** The layout-qa skill's rules, inlined so any provider follows the same contract. */
function layoutQaRules(): string {
  try {
    const skill = fs.readFileSync(path.join(CONFIG.projectRoot, '.claude/skills/layout-qa/SKILL.md'), 'utf-8');
    return skill.replace(/^---[\s\S]*?---\n/, '').trim();
  } catch {
    return '';
  }
}

function renderIssues(issues: ConsolidatedIssues): string {
  const lines: string[] = [];
  if (issues.geometry.length) {
    lines.push('## Deterministic geometry violations (authoritative — fix these)');
    for (const v of issues.geometry) {
      const times = v.occurrences && v.occurrences > 1 ? ` (×${v.occurrences})` : '';
      lines.push(
        `- [${v.severity}] ${v.type} on ${v.page} @ ${v.viewport}${times}\n` +
          `  selector: ${v.selector}\n` +
          `  ${v.detail}` +
          (v.measurements ? `\n  measurements: ${JSON.stringify(v.measurements)}` : ''),
      );
    }
  }
  if (issues.visual.length) {
    lines.push('\n## Visual review findings (corroborating — address where they align with geometry)');
    for (const f of issues.visual) {
      lines.push(`- (${f.source}${f.page ? `, ${f.page}` : ''}) ${f.problem}`);
    }
  }
  return lines.join('\n');
}

/**
 * Run one fix pass. The agent has Read/Edit/Bash and the layout-qa skill.
 * Returns a structured summary of what it changed (best-effort).
 */
export async function runFixPass(issues: ConsolidatedIssues): Promise<FixSummary> {
  const rules = layoutQaRules();
  const prompt = `You are fixing layout-geometry defects on the sreeraj.dev site. Follow the layout-qa rules below exactly: fix the geometry, never alter the approved visual style, never delete required CSS classes, never mask overflow with hidden/clipping or by shrinking fonts.
${rules ? `\n## layout-qa rules\n\n${rules}\n` : ''}
The authoritative report is at \`automation/test-output/layout-report.json\`. Here is the consolidated issue list:

${renderIssues(issues)}

Steps:
1. Read the report and the relevant rules in the CSS / component files for the reported selectors.
2. Make the smallest change that fixes each root cause, applying the same fix to both \`[data-theme="tech"]\` and \`[data-theme="trek"]\` where relevant. Prefer responsive rules (media queries, \`min()\`/\`clamp()\`, \`minmax(0, 1fr)\`) over hard overrides.
3. Summarize what you changed.

Do NOT run \`npm run build\` or the geometry analyzer — the orchestrator rebuilds and re-checks after you finish. Spend your turns editing, not building. Work from the repository root. Do not commit. Never edit anything under automation/.`;

  const result = await runAgent<Partial<FixSummary>>({
    role: 'fixer',
    label: 'layout-fixer',
    prompt,
    schema: FIX_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
  });
  if (!result.ok) throw new Error(`fixer agent failed: ${result.error}`);

  return {
    filesChanged: result.data?.filesChanged ?? [],
    changes: result.data?.changes ?? '',
    notes: result.data?.notes ?? '',
  };
}
