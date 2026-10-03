/**
 * Invariants every monthly design must keep. Per-page checks run as ONE test per group with soft
 * assertions: each failure still names its page, but Playwright restarts a worker (and Chrome)
 * after every failed test, so one test per page made a broken design take 15+ minutes to report.
 *
 * Tags:
 *   @hard    — a failure blocks the redesign (the runner's fix loop must resolve it)
 *   @report  — recorded in the report, never blocks (calibrated against live designs first)
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { archiveMonths, posts, sitemapPaths, templatePages } from './site.js';

const POSTS = posts();
const PATHS = sitemapPaths();
const TEMPLATES = templatePages();
// Letters and digits only: markdown punctuation and typographic quotes differ from the rendered text.
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

/** Collect page errors and same-origin requests that failed while `fn` runs. */
async function watch(page: Page, fn: () => Promise<void>) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1')) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', r => {
    if (r.url().startsWith('http://127.0.0.1')) failed.push(`failed ${r.url()}`);
  });
  await fn();
  return { errors, failed };
}

test.describe('routes @hard', () => {
  test(`all ${PATHS.length} sitemap pages render`, async ({ page }) => {
    test.setTimeout(PATHS.length * 15_000);
    for (const p of PATHS) {
      const { errors, failed } = await watch(page, async () => {
        const res = await page.goto(p, { waitUntil: 'load' });
        expect.soft(res?.status(), `${p}: HTTP status`).toBe(200);
      });
      expect.soft(await page.title(), `${p}: <title>`).toMatch(/\S/);
      expect.soft(await page.locator('h1').count(), `${p}: at least one <h1>`).toBeGreaterThan(0);
      expect.soft(errors, `${p}: uncaught page errors`).toEqual([]);
      expect.soft(failed, `${p}: same-origin requests that failed`).toEqual([]);
      page.removeAllListeners('pageerror');
      page.removeAllListeners('response');
      page.removeAllListeners('requestfailed');
    }
  });
});

test.describe('content @hard', () => {
  test('every post has a page', () => {
    for (const p of POSTS) expect(PATHS, `sitemap has /${p.slug}/`).toContain(`/${p.slug}/`);
  });
  test(`all ${POSTS.length} posts show their title and body`, async ({ page }) => {
    test.setTimeout(POSTS.length * 15_000);
    for (const p of POSTS) {
      await page.goto(`/${p.slug}/`);
      await expect.soft(page.locator('[data-qa="post-title"]'), `/${p.slug}/: title`).toContainText(p.title.slice(0, 40));
      const body = page.locator('[data-qa="post-body"]');
      if (!(await body.count())) {
        expect.soft(0, `/${p.slug}/: [data-qa="post-body"] missing`).toBe(1);
        continue;
      }
      if (p.firstText) expect.soft(norm(await body.innerText()), `/${p.slug}/: first paragraph`).toContain(norm(p.firstText).slice(0, 30));
    }
  });
  test('RSS lists every post', async ({ request }) => {
    const res = await request.get('/rss.xml');
    expect(res.status()).toBe(200);
    const items = ((await res.text()).match(/<item>/g) ?? []).length;
    expect(items).toBe(POSTS.length);
  });
  test('about and contact keep their text', async ({ page }) => {
    for (const p of ['/about/', '/contact/']) {
      await page.goto(p);
      expect((await page.locator('main, body').first().innerText()).length, `${p} has text`).toBeGreaterThan(200);
    }
  });
});

test.describe('markup contract @hard', () => {
  test('home: nav, post list, post cards, footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-qa="site-nav"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="post-list"]').first()).toBeVisible();
    expect(await page.locator('[data-qa="post-card"]').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('[data-qa="site-footer"]')).toHaveCount(1);
  });
  test('post: title, body, tag list', async ({ page }) => {
    const p = POSTS.find(x => x.tags.length) ?? POSTS[0];
    await page.goto(`/${p.slug}/`);
    await expect(page.locator('[data-qa="post-title"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="post-body"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="tag-list"]').first()).toBeVisible();
  });
  test('section and tag pages: post list', async ({ page }) => {
    for (const p of ['/devops/', '/tags/' + encodeURIComponent(POSTS[0].tags[0] ?? 'tech') + '/']) {
      await page.goto(p);
      await expect(page.locator('[data-qa="post-list"]').first(), p).toBeVisible();
    }
  });
  test('contact: contact block', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('[data-qa="contact"]')).toBeVisible();
  });
});

test.describe('navigation @hard', () => {
  const REQUIRED = ['/', '/about/', '/devops/', '/treks/', '/programming/', '/postgres/', '/archive/'];
  for (const width of [1280, 390]) {
    test(`site nav links at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/about/');
      const hrefs = await page.locator('[data-qa="site-nav"] a').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')));
      for (const h of REQUIRED) expect(hrefs, `nav links to ${h}`).toContain(h);
    });
  }
});

test.describe('layout @hard', () => {
  for (const width of [390, 768, 1280]) {
    test(`no horizontal scroll at ${width}px on any template`, async ({ page }) => {
      test.setTimeout(TEMPLATES.length * 15_000);
      await page.setViewportSize({ width, height: 900 });
      for (const t of TEMPLATES) {
        await page.goto(t.path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect.soft(over, `${t.name} (${t.path}): pixels of horizontal scroll`).toBeLessThanOrEqual(2);
      }
    });
  }
  test('post body text is at least 15px', async ({ page }) => {
    const p = TEMPLATES.find(x => x.name === 'post-code')!;
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(p.path);
      const para = page.locator('[data-qa="post-body"] p').first();
      await expect(para, 'a paragraph inside [data-qa="post-body"]').toHaveCount(1);
      const size = await para.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect.soft(size, `font size at ${width}px`).toBeGreaterThanOrEqual(15);
    }
  });
});

test.describe('readability @report', () => {
  test('post line length is 45-95 characters', async ({ page }) => {
    const p = TEMPLATES.find(x => x.name === 'post-code')!;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(p.path);
    const chars = await page.locator('[data-qa="post-body"] p').first().evaluate(el => {
      const style = getComputedStyle(el);
      const probe = document.createElement('span');
      probe.textContent = 'abcdefghijklmnopqrstuvwxyz'.repeat(4);
      probe.style.font = style.font;
      probe.style.visibility = 'hidden';
      document.body.appendChild(probe);
      const perChar = probe.getBoundingClientRect().width / 104;
      probe.remove();
      return el.getBoundingClientRect().width / perChar;
    });
    test.info().annotations.push({ type: 'line-length', description: chars.toFixed(0) });
    expect(chars).toBeGreaterThanOrEqual(45);
    expect(chars).toBeLessThanOrEqual(95);
  });
});

test.describe('accessibility', () => {
  for (const t of TEMPLATES.filter(x => ['home', 'post-code', 'post-trek', 'contact'].includes(x.name))) {
    test(`${t.name} has no critical axe violations @hard`, async ({ page }) => {
      await page.goto(t.path);
      const r = await new AxeBuilder({ page }).analyze();
      const critical = r.violations.filter(v => v.impact === 'critical');
      expect(critical.map(v => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
    test(`${t.name} has no serious axe violations @report`, async ({ page }) => {
      await page.goto(t.path);
      const r = await new AxeBuilder({ page }).analyze();
      const serious = r.violations.filter(v => v.impact === 'serious');
      test.info().annotations.push({ type: 'axe-serious', description: serious.map(v => `${v.id} (${v.nodes.length})`).join(', ') || 'none' });
      expect(serious.map(v => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});

test.describe('archive @hard', () => {
  test('archive index and every edition load', async ({ page, request }) => {
    const res = await page.goto('/archive/');
    expect(res?.status()).toBe(200);
    for (const m of archiveMonths()) {
      const r = await request.get(`/archive/${m}/`);
      expect(r.status(), `/archive/${m}/`).toBe(200);
    }
  });
});
