/**
 * Undo agent edits under automation/: the tests, prompts and pipeline that judge a design must
 * not be changed by the agent being judged. automation/history/ (ideation state, the design log)
 * and the ignored test-output/ are the only writable places.
 *
 *   npx tsx pipeline/guard.ts      # prints what it restored; exit 0
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

const ALLOWED = [/^automation\/history\//, /^automation\/test-output\//, /^automation\/test-results\//];

/** Restore tracked files and delete new untracked files under automation/. Returns the paths. */
export function restoreAutomation(root: string = CONFIG.projectRoot): string[] {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf-8' });
  const restored: string[] = [];
  for (const line of git(['status', '--porcelain', '--untracked-files=all', '--', 'automation']).split('\n')) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    const file = line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop()!;
    if (ALLOWED.some(r => r.test(file))) continue;
    if (status === '??') fs.rmSync(path.join(root, file), { force: true, recursive: true });
    else git(['checkout', 'HEAD', '--', file]);
    restored.push(file);
  }
  return restored;
}

if (process.argv[1]?.endsWith('guard.ts')) {
  const restored = restoreAutomation();
  process.stdout.write(restored.length ? `guard: restored ${restored.length} file(s) under automation/: ${restored.join(', ')}\n` : 'guard: automation/ untouched\n');
}
