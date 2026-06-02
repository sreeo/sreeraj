import { TRENDS, DesignTrend, DesignLog, selectTrend } from './trend-registry.js';
import { agentJson } from './agent-query.js';

export interface DiscoveredTrend extends DesignTrend {
  source: 'discovered' | 'classic';
}

const TREND_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    structure: { type: 'string' },
    typography: { type: 'string' },
    spacing: { type: 'string' },
    interactions: { type: 'string' },
    references: { type: 'string' },
    source: { type: 'string', enum: ['discovered', 'classic'] },
  },
  required: ['id', 'name', 'description', 'structure', 'typography', 'spacing', 'interactions', 'references', 'source'],
  additionalProperties: false,
} as const;

/**
 * Uses Claude (via the Agent SDK + WebSearch tool, on the Claude Code session —
 * no API key) to research current web design trends and propose a specific
 * design for this month's redesign. Falls back to the classic registry on any
 * failure.
 */
export async function discoverTrend(
  designLog: DesignLog,
  previousTrend: string | null,
): Promise<DiscoveredTrend> {
  const now = new Date();
  const monthLabel = `${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}`;

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recentlyUsed = designLog.designs
    .filter(d => d.status === 'success' && new Date(d.timestamp) > twelveMonthsAgo)
    .map(d => d.trendName);

  const classicList = TRENDS.map(t => `- ${t.name}: ${t.description}`).join('\n');

  console.log('Discovering current design trends via web search...');

  const prompt = `You are selecting a design style for a personal tech blog (sreeraj.dev) for ${monthLabel}.

## Your Task
1. Use the WebSearch tool to research current web design trends, CSS design trends, and award-winning website designs in ${now.getFullYear()} (e.g. Awwwards, CSS Design Awards, Dribbble, design blogs).
2. Based on your research AND the classic styles below, propose ONE specific design style for this month.

## Classic Styles Available (pick one or propose something new from your research):
${classicList}

## Recently Used (AVOID these):
${recentlyUsed.length > 0 ? recentlyUsed.map(t => `- ${t}`).join('\n') : '- None yet'}

${previousTrend ? `## Previous Month: ${previousTrend}\nPick something structurally DIFFERENT from this.` : ''}

## What Makes a Good Pick
- The design must be about STRUCTURE, TYPOGRAPHY, and LAYOUT — not just colors.
- It must produce readable, usable websites.
- It should feel fresh and current, not dated.
- It can be a classic style, a current trend, or a creative hybrid.

Return the chosen design as JSON with: id (kebab-case), name, description (2-3 sentences),
structure, typography, spacing, interactions (each a detailed description), references
(3-5 reference sites/designers), and source ("discovered" or "classic").`;

  try {
    const trend = await agentJson<DiscoveredTrend>(prompt, TREND_SCHEMA, {
      allowedTools: ['WebSearch'],
      maxTurns: 12,
    });

    if (!trend || !trend.id || !trend.name || !trend.description || !trend.structure || !trend.typography) {
      console.log('  Discovery returned no/incomplete trend, falling back to classic.');
      return fallbackToClassic(designLog);
    }

    console.log(`  Discovered: ${trend.name} (${trend.source})`);
    return trend;
  } catch (e) {
    console.log(`  Discovery failed (${e instanceof Error ? e.message : e}), falling back to classic.`);
    return fallbackToClassic(designLog);
  }
}

function fallbackToClassic(designLog: DesignLog): DiscoveredTrend {
  const trend = selectTrend(designLog);
  return { ...trend, source: 'classic' as const };
}
