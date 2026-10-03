/**
 * Creative rebuild: run the implementer agent on the rendered rebuild prompt.
 *
 *   npx tsx pipeline/rebuild.ts /tmp/rebuild-prompt.md
 *
 * Runs on the first provider in the implementer role's order and falls back to the next one on
 * a login error, rate limit or timeout. The runner decides success from the src/ diff, as before;
 * this exits non-zero only when no provider ran at all.
 */
import fs from 'fs';
import { runAgent } from './agent.js';

const promptFile = process.argv[2];
if (!promptFile || !fs.existsSync(promptFile)) {
  process.stderr.write('usage: rebuild.ts <prompt-file>\n');
  process.exit(2);
}

const result = await runAgent({
  role: 'implementer',
  label: 'rebuild',
  prompt: fs.readFileSync(promptFile, 'utf-8'),
});

process.stderr.write(
  result.ok
    ? `rebuild: done on ${result.provider}/${result.model}${result.hitTurnLimit ? ' (hit turn limit)' : ''}\n`
    : `rebuild: no provider completed — ${result.error}\n`,
);
process.exit(result.ok ? 0 : 1);
