import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from './config.js';
import { TRENDS, DesignTrend, DesignLog, selectTrend } from './trend-registry.js';

const client = new Anthropic();

export interface DiscoveredTrend extends DesignTrend {
  source: 'discovered' | 'classic';
}

/**
 * Uses Claude with web search to discover current design trends,
 * then picks/proposes a trend for this month's redesign.
 *
 * Flow:
 * 1. Claude searches the web for current web design trends
 * 2. Claude analyzes the search results + our classic trends list
 * 3. Claude proposes a specific design with full structural details
 */
export async function discoverTrend(
  designLog: DesignLog,
  previousTrend: string | null
): Promise<DiscoveredTrend> {
  const now = new Date();
  const monthLabel = `${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}`;

  // Build list of recently used trends to avoid
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recentlyUsed = designLog.designs
    .filter(d => d.status === 'success' && new Date(d.timestamp) > twelveMonthsAgo)
    .map(d => d.trendName);

  // Classic trends as reference
  const classicList = TRENDS.map(t => `- ${t.name}: ${t.description}`).join('\n');

  console.log('Discovering current design trends via web search...');

  const response = await client.messages.create({
    model: CONFIG.model,
    max_tokens: 4096,
    temperature: 0.7,
    tools: [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        allowed_callers: ['direct'],
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content: `You are selecting a design style for a personal tech blog (sreeraj.dev) for ${monthLabel}.

## Your Task
1. Search the web for current web design trends, CSS design trends, and award-winning website designs in ${now.getFullYear()}.
2. Look at what's trending on sites like Awwwards, CSS Design Awards, Dribbble, or design blogs.
3. Based on your research AND the classic styles listed below, propose ONE specific design style for this month.

## Classic Styles Available (you can pick one of these or propose something new based on your research):
${classicList}

## Recently Used (AVOID these):
${recentlyUsed.length > 0 ? recentlyUsed.map(t => `- ${t}`).join('\n') : '- None yet'}

${previousTrend ? `## Previous Month: ${previousTrend}\nPick something structurally DIFFERENT from this.` : ''}

## What Makes a Good Pick
- The design must be about STRUCTURE, TYPOGRAPHY, and LAYOUT — not just colors
- It must produce readable, usable websites
- It should feel fresh and current, not dated
- It can be a classic style, a current trend, or a creative hybrid

## Response Format
Respond with EXACTLY this JSON format (no other text):
{
  "id": "kebab-case-id",
  "name": "Human Readable Name",
  "description": "2-3 sentences about what this style IS and what makes it iconic.",
  "structure": "Detailed description of layout structure, grid, card design, section organization.",
  "typography": "Detailed description of font usage, sizes, weights, spacing, hierarchy.",
  "spacing": "Detailed description of padding, margins, gaps, whitespace philosophy.",
  "interactions": "Detailed description of hover states, transitions, animations, scroll effects.",
  "references": "3-5 reference websites or designers that exemplify this style.",
  "source": "discovered" or "classic"
}`,
      },
    ],
  });

  // Extract the JSON from Claude's response (it may include search results and reasoning before the JSON)
  let jsonStr = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      jsonStr += block.text;
    }
  }

  // Find the JSON object in the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*"id"[\s\S]*"source"[\s\S]*?\}/);
  if (!jsonMatch) {
    console.log('  Could not parse trend from Claude response, falling back to classic');
    console.log('  Response:', jsonStr.slice(0, 500));
    return fallbackToClassic(designLog);
  }

  try {
    const trend = JSON.parse(jsonMatch[0]) as DiscoveredTrend;

    // Validate required fields
    if (!trend.id || !trend.name || !trend.description || !trend.structure || !trend.typography) {
      console.log('  Parsed trend missing required fields, falling back to classic');
      return fallbackToClassic(designLog);
    }

    console.log(`  Discovered: ${trend.name} (${trend.source})`);
    return trend;
  } catch (e) {
    console.log('  JSON parse failed, falling back to classic');
    return fallbackToClassic(designLog);
  }
}

function fallbackToClassic(designLog: DesignLog): DiscoveredTrend {
  const trend = selectTrend(designLog);
  return { ...trend, source: 'classic' as const };
}
