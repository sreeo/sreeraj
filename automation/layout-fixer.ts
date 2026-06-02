/**
 * Layout fixer — the Claude Agent SDK half of the layout QA stage.
 *
 * Given a consolidated list of layout issues (deterministic geometry violations
 * plus any agentic visual findings), it runs an Agent SDK `query()` that loads
 * the `layout-qa` skill and edits the CSS to resolve them — without touching the
 * approved visual style. The orchestrator drives the build/re-check loop; this
 * module performs one focused fix pass and reports what it changed.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
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
  required: ['filesChanged', 'changes'],
  additionalProperties: false,
} as const;

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
  const prompt = `You are fixing layout-geometry defects on the sreeraj.dev site. Use the **layout-qa skill** — follow its contract exactly: fix the geometry, never alter the approved visual style, never delete required CSS classes, never mask overflow with hidden/clipping or by shrinking fonts.

The authoritative report is at \`automation/test-output/layout-report.json\`. Here is the consolidated issue list:

${renderIssues(issues)}

Steps:
1. Read the report and the relevant rules in the CSS / component files for the reported selectors.
2. Make the smallest change that fixes each root cause, applying the same fix to both \`[data-theme="tech"]\` and \`[data-theme="trek"]\` where relevant. Prefer responsive rules (media queries, \`min()\`/\`clamp()\`, \`minmax(0, 1fr)\`) over hard overrides.
3. Summarize what you changed.

Do NOT run \`npm run build\` or the geometry analyzer — the orchestrator rebuilds and re-checks after you finish. Spend your turns editing, not building. Work from the repository root. Do not commit.`;

  const summary: FixSummary = { filesChanged: [], changes: '', notes: '' };

  for await (const message of query({
    prompt,
    options: {
      cwd: CONFIG.projectRoot,
      model: CONFIG.layoutQa.fixerModel,
      maxTurns: CONFIG.layoutQa.fixerMaxTurns,
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
      permissionMode: 'acceptEdits',
      settingSources: ['project'],
      skills: ['layout-qa'],
      outputFormat: {
        type: 'json_schema',
        schema: FIX_OUTPUT_SCHEMA,
      },
    },
  })) {
    if (
      message.type === 'result' &&
      (message as any).subtype === 'success' &&
      (message as any).structured_output
    ) {
      const so = (message as any).structured_output as Partial<FixSummary>;
      summary.filesChanged = so.filesChanged ?? [];
      summary.changes = so.changes ?? '';
      summary.notes = so.notes ?? '';
    }
  }

  return summary;
}
