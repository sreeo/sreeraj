/**
 * Facts about the built site that every design must keep, read from the source and from dist/.
 * Shared by the e2e specs and by the visual QA page inventory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';

const ROOT = CONFIG.projectRoot;
export const DIST = path.join(ROOT, 'dist');

/** Every same-site path in the sitemap, e.g. "/about/". */
export function sitemapPaths(): string[] {
  const files = fs.readdirSync(DIST).filter(f => /^sitemap-\d+\.xml$/.test(f));
  const urls = files.flatMap(f => [...fs.readFileSync(path.join(DIST, f), 'utf-8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  return [...new Set(urls.map(u => new URL(u).pathname))].sort();
}

export interface Post {
  slug: string;
  title: string;
  tags: string[];
  /** First plain-text paragraph of the body, used to prove the content rendered. */
  firstText: string;
  hasCode: boolean;
  length: number;
}

function frontmatter(src: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  let key = '';
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      data[key] = kv[2].trim();
    } else if (key && /^\s+-\s+/.test(line)) {
      data[key] = `${data[key]}\n${line.trim()}`;
    }
  }
  return { data, body: m[2] };
}

const unquote = (s = '') => s.replace(/^['"]|['"]$/g, '');

function plainParagraph(body: string): string {
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, ' ');
  for (const block of prose.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || /^(#|```|<|!\[|\||>|-|\*|\d+\.)/.test(t)) continue;
    const text = t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 30) return text;
  }
  return '';
}

export function posts(): Post[] {
  const dir = path.join(ROOT, 'src/content/blog');
  return fs.readdirSync(dir).filter(f => /\.mdx?$/.test(f)).map(f => {
    const src = fs.readFileSync(path.join(dir, f), 'utf-8');
    const { data, body } = frontmatter(src);
    const tags = (data.tags ?? '')
      .replace(/^\[|\]$/g, '')
      .split(/[\n,]/)
      .map(t => unquote(t.replace(/^-\s*/, '').trim()))
      .filter(Boolean);
    return {
      slug: unquote(data.slug) || f.replace(/\.mdx?$/, ''),
      title: unquote(data.title),
      tags,
      firstText: plainParagraph(body),
      hasCode: body.includes('```'),
      length: body.length,
    };
  });
}

export function archiveMonths(): string[] {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/archive/registry.json'), 'utf-8'));
    return (reg.archives ?? []).map((a: { month: string }) => a.month);
  } catch {
    return [];
  }
}

export interface TemplatePage {
  name: string;
  path: string;
}

/**
 * One URL per page template — the pages visual QA screenshots and the layout checks visit.
 * Picks real content: the longest post with code, a trek post, the busiest tag, the newest edition.
 */
export function templatePages(): TemplatePage[] {
  const all = posts();
  const codePost = [...all].filter(p => p.hasCode).sort((a, b) => b.length - a.length)[0];
  const trekPost = all.find(p => p.tags.some(t => /trek/i.test(t)));
  const tagCounts = new Map<string, number>();
  for (const p of all) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const busiestTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const newestEdition = archiveMonths().sort().reverse()[0];
  const pages: (TemplatePage | null)[] = [
    { name: 'home', path: '/' },
    { name: 'about', path: '/about/' },
    { name: 'contact', path: '/contact/' },
    { name: 'devops', path: '/devops/' },
    { name: 'programming', path: '/programming/' },
    { name: 'postgres', path: '/postgres/' },
    { name: 'treks', path: '/treks/' },
    codePost ? { name: 'post-code', path: `/${codePost.slug}/` } : null,
    trekPost ? { name: 'post-trek', path: `/${trekPost.slug}/` } : null,
    { name: 'tags', path: '/tags/' },
    busiestTag ? { name: 'tag', path: `/tags/${encodeURIComponent(busiestTag)}/` } : null,
    { name: 'archive', path: '/archive/' },
    newestEdition ? { name: 'archive-edition', path: `/archive/${newestEdition}/` } : null,
    { name: '404', path: '/404.html' },
  ];
  return pages.filter((p): p is TemplatePage => p !== null);
}
