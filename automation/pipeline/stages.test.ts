import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseReport } from './e2e-stage.js';
import { restoreAutomation } from './guard.js';
import { galleryMarkdown, repoSlug } from './publish-shots.js';
import { blockingIssues, validateVerdict } from './visual-qa.js';

describe('restoreAutomation', () => {
  it('undoes edits and new files under automation/, but keeps history/ and site changes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: root, encoding: 'utf-8' });
    const write = (f: string, c: string) => {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), c);
    };
    git('init', '-q');
    write('automation/e2e/site.spec.ts', 'original');
    write('automation/history/design-log.json', '{}');
    write('src/pages/index.astro', 'page');
    git('add', '-A');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');

    write('automation/e2e/site.spec.ts', 'weakened');
    write('automation/e2e/extra.spec.ts', 'new');
    write('automation/history/design-log.json', '{"x":1}');
    write('src/pages/index.astro', 'redesigned');

    const restored = restoreAutomation(root);
    assert.deepEqual(restored.sort(), ['automation/e2e/extra.spec.ts', 'automation/e2e/site.spec.ts']);
    assert.equal(fs.readFileSync(path.join(root, 'automation/e2e/site.spec.ts'), 'utf-8'), 'original');
    assert.equal(fs.existsSync(path.join(root, 'automation/e2e/extra.spec.ts')), false);
    assert.equal(fs.readFileSync(path.join(root, 'automation/history/design-log.json'), 'utf-8'), '{"x":1}');
    assert.equal(fs.readFileSync(path.join(root, 'src/pages/index.astro'), 'utf-8'), 'redesigned');
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('parseReport', () => {
  it('lists every failed soft assertion with its test, and counts', () => {
    const report = {
      stats: { expected: 23, unexpected: 2 },
      suites: [{
        suites: [{
          specs: [
            { title: 'all 20 posts show their title and body', tests: [{ results: [{ status: 'failed', errors: [
              { message: '\u001b[31mError: /a/: [data-qa="post-body"] missing\u001b[39m\n\nExpected: 1' },
              { message: 'Error: /b/: [data-qa="post-body"] missing' },
            ] }] }] },
            { title: 'no horizontal scroll at 390px on any template', tests: [{ results: [{ status: 'failed', error: { message: 'Error: post-code (/x/): pixels of horizontal scroll' } }] }] },
            { title: 'archive index and every edition load', tests: [{ results: [{ status: 'passed' }] }] },
          ],
        }],
      }],
    };
    const r = parseReport(report);
    assert.equal(r.passed, false);
    assert.equal(r.unexpected, 2);
    assert.deepEqual(r.failures, [
      'all 20 posts show their title and body — Error: /a/: [data-qa="post-body"] missing',
      'all 20 posts show their title and body — Error: /b/: [data-qa="post-body"] missing',
      'no horizontal scroll at 390px on any template — Error: post-code (/x/): pixels of horizontal scroll',
    ]);
  });
  it('passes a clean report', () => {
    assert.equal(parseReport({ stats: { expected: 25, unexpected: 0 }, suites: [] }).passed, true);
  });
});

describe('visual QA gate', () => {
  const page = (name: string) => ({ name, path: `/${name}/` });
  const issue = (severity: 'high' | 'medium' | 'low', kind: any) => ({ severity, kind, viewport: 'mobile' as const, where: 'x', description: 'y' });

  it('blocks on pages that do not render and on high issues of blocking kinds only', () => {
    const b = blockingIssues([
      { page: page('home'), shots: [], verdict: { rendersOk: true, styleFidelity: 8, summary: '', issues: [issue('high', 'overlap'), issue('high', 'off-style'), issue('medium', 'clipped')] } },
      { page: page('about'), shots: [], verdict: { rendersOk: false, styleFidelity: 2, summary: '', issues: [] } },
      { page: page('tags'), shots: [], error: 'agent failed' },
    ]);
    assert.deepEqual(b.map(x => `${x.page}:${'kind' in x.issue ? x.issue.kind : 'render'}`), ['home:overlap', 'about:render']);
  });
  it('rejects out-of-range fidelity and unknown kinds', () => {
    assert.throws(() => validateVerdict({ rendersOk: true, styleFidelity: 12, issues: [], summary: '' }), /0-10/);
    assert.throws(() => validateVerdict({ rendersOk: true, styleFidelity: 5, issues: [issue('high', 'ugly')], summary: '' }), /bad kind/);
  });
});

describe('screenshot gallery', () => {
  it('reads the repo slug from https and ssh remotes', () => {
    assert.equal(repoSlug('https://github.com/sreeo/sreeraj.git'), 'sreeo/sreeraj');
    assert.equal(repoSlug('git@github.com:sreeo/sreeraj'), 'sreeo/sreeraj');
  });
  it('links raw images on the assets branch and marks missing ones', () => {
    const md = galleryMarkdown('sreeo/sreeraj', '2026-11/run1', ['home', 'about'], new Set(['home-390.jpg', 'home-1280.jpg', 'about-1280.jpg']));
    assert.match(md, /raw\.githubusercontent\.com\/sreeo\/sreeraj\/redesign-assets\/2026-11\/run1\/home-390\.jpg/);
    assert.match(md, /\| about \| – \| <a href=/);
  });
});
