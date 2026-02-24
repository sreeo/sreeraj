#!/usr/bin/env node
/**
 * One-time script to export Ghost blog content to Astro-compatible Markdown files.
 * Fetches posts, pages, and tags from Ghost Content API, converts HTML to Markdown,
 * downloads images, and generates frontmatter-equipped .md files.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GHOST_URL = 'http://sreeraj.dev';
const GHOST_KEY = 'd627b69ab57adc7f9d3c6c0fd1';
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const PAGES_DIR = path.join(ROOT, 'src/content/pages');
const IMAGES_DIR = path.join(BLOG_DIR, 'images');

// --- Ghost API helpers ---

async function ghostFetch(resource, params = {}) {
  const url = new URL(`/ghost/api/content/${resource}/`, GHOST_URL);
  url.searchParams.set('key', GHOST_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchAll(resource, params = {}) {
  let page = 1;
  let items = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await ghostFetch(resource, { ...params, page: String(page), limit: '50' });
    const key = resource; // 'posts', 'pages', 'tags'
    items = items.concat(data[key] || []);
    totalPages = data.meta?.pagination?.pages || 1;
    page++;
  }
  return items;
}

// --- Turndown (HTML → Markdown) ---

function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Ghost image cards: <figure class="kg-card kg-image-card"> → ![alt](src)
  td.addRule('kg-image-card', {
    filter: (node) => {
      return node.nodeName === 'FIGURE' &&
        node.getAttribute('class')?.includes('kg-image-card');
    },
    replacement: (_content, node) => {
      const img = node.querySelector('img');
      const caption = node.querySelector('figcaption');
      if (!img) return '';
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || caption?.textContent?.trim() || '';
      let md = `\n![${alt}](${src})\n`;
      if (caption) {
        md += `*${caption.textContent.trim()}*\n`;
      }
      return md;
    },
  });

  // Ghost bookmark cards
  td.addRule('kg-bookmark-card', {
    filter: (node) => {
      return node.nodeName === 'FIGURE' &&
        node.getAttribute('class')?.includes('kg-bookmark-card');
    },
    replacement: (_content, node) => {
      const link = node.querySelector('a');
      if (!link) return '';
      const href = link.getAttribute('href') || '';
      const title = node.querySelector('.kg-bookmark-title')?.textContent?.trim() || href;
      const desc = node.querySelector('.kg-bookmark-description')?.textContent?.trim() || '';
      return `\n> [${title}](${href})${desc ? `\n> ${desc}` : ''}\n`;
    },
  });

  // Ghost code cards: <pre><code> with optional language
  td.addRule('kg-code-card', {
    filter: (node) => {
      return node.nodeName === 'PRE' && node.querySelector('code');
    },
    replacement: (_content, node) => {
      const code = node.querySelector('code');
      if (!code) return '';
      const text = code.textContent || '';
      let lang = code.getAttribute('class')?.replace('language-', '') || '';
      // Normalize language names
      lang = normalizeLanguage(lang);
      return `\n\`\`\`${lang}\n${text.replace(/\n$/, '')}\n\`\`\`\n`;
    },
  });

  return td;
}

const LANG_MAP = {
  python3: 'python',
  py: 'python',
  compose: 'yaml',
  'docker-compose': 'yaml',
  textfile: 'text',
  plaintext: 'text',
  plain: 'text',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  conf: 'text',
  ini: 'text',
};

function normalizeLanguage(lang) {
  const lower = lang.toLowerCase().trim();
  return LANG_MAP[lower] || lower;
}

// --- Image downloading ---

async function downloadImage(url, destDir) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  Warning: Failed to download ${url} (${res.status})`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = path.basename(new URL(url).pathname);
    const destPath = path.join(destDir, filename);
    await fs.writeFile(destPath, buffer);
    return filename;
  } catch (err) {
    console.warn(`  Warning: Error downloading ${url}: ${err.message}`);
    return null;
  }
}

async function processImages(markdown, slug) {
  const imageDir = path.join(IMAGES_DIR, slug);
  // Match both markdown images and raw Ghost URLs
  const ghostImageRegex = /https?:\/\/sreeraj\.dev\/content\/images\/[^\s)"\]]+/g;
  const matches = [...new Set(markdown.match(ghostImageRegex) || [])];

  if (matches.length === 0) return markdown;

  await fs.mkdir(imageDir, { recursive: true });
  let result = markdown;

  for (const url of matches) {
    const filename = await downloadImage(url, imageDir);
    if (filename) {
      const relativePath = `./images/${slug}/${filename}`;
      result = result.replaceAll(url, relativePath);
    }
  }
  return result;
}

// --- Frontmatter & file generation ---

function calculateReadingTime(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

function buildFrontmatter(post, isPage = false) {
  const fm = {
    title: post.title,
    slug: post.slug,
    description: post.custom_excerpt || post.excerpt || post.meta_description || '',
    pubDate: post.published_at,
    updatedDate: post.updated_at,
  };

  if (!isPage) {
    fm.featured = post.featured || false;
    fm.featureImage = post.feature_image || '';
    fm.tags = (post.tags || [])
      .filter(t => !t.name.startsWith('#'))
      .map(t => t.name);
    fm.author = post.primary_author?.name || 'Sreeraj';
    fm.readingTime = calculateReadingTime(post.plaintext || post.html || '');
  } else {
    fm.featureImage = post.feature_image || '';
  }

  // YAML frontmatter
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === '' || value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - "${item.replace(/"/g, '\\"')}"`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      // Escape quotes in strings
      const escaped = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// --- Main export ---

async function main() {
  console.log('Fetching content from Ghost API...');

  const [posts, pages, tags] = await Promise.all([
    fetchAll('posts', { include: 'tags,authors', formats: 'html,plaintext' }),
    fetchAll('pages', { include: 'tags,authors', formats: 'html,plaintext' }),
    fetchAll('tags', { filter: 'visibility:public' }),
  ]);

  console.log(`Found: ${posts.length} posts, ${pages.length} pages, ${tags.length} tags`);

  // Ensure directories exist
  await fs.mkdir(BLOG_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const turndown = createTurndown();

  // Export posts
  console.log('\nExporting posts...');
  for (const post of posts) {
    console.log(`  ${post.slug}`);
    let markdown = turndown.turndown(post.html || '');
    markdown = await processImages(markdown, post.slug);
    // Also process feature image
    if (post.feature_image?.includes('sreeraj.dev/content/images/')) {
      const imgDir = path.join(IMAGES_DIR, post.slug);
      await fs.mkdir(imgDir, { recursive: true });
      const filename = await downloadImage(post.feature_image, imgDir);
      if (filename) {
        post.feature_image = `./images/${post.slug}/${filename}`;
      }
    }
    const frontmatter = buildFrontmatter(post);
    const content = `${frontmatter}\n\n${markdown}\n`;
    await fs.writeFile(path.join(BLOG_DIR, `${post.slug}.md`), content);
  }

  // Export pages
  console.log('\nExporting pages...');
  for (const page of pages) {
    console.log(`  ${page.slug}`);
    let markdown = turndown.turndown(page.html || '');
    markdown = await processImages(markdown, page.slug);
    if (page.feature_image?.includes('sreeraj.dev/content/images/')) {
      const imgDir = path.join(IMAGES_DIR, page.slug);
      await fs.mkdir(imgDir, { recursive: true });
      const filename = await downloadImage(page.feature_image, imgDir);
      if (filename) {
        page.feature_image = `./images/${page.slug}/${filename}`;
      }
    }
    const frontmatter = buildFrontmatter(page, true);
    const content = `${frontmatter}\n\n${markdown}\n`;
    await fs.writeFile(path.join(PAGES_DIR, `${page.slug}.md`), content);
  }

  // Save tags for reference
  const tagData = tags.map(t => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    count: t.count?.posts || 0,
  }));
  await fs.writeFile(
    path.join(ROOT, 'scripts/tags.json'),
    JSON.stringify(tagData, null, 2)
  );

  console.log('\nExport complete!');
  console.log(`  Blog posts: ${posts.length} files in ${BLOG_DIR}`);
  console.log(`  Pages: ${pages.length} files in ${PAGES_DIR}`);
  console.log(`  Tags: ${tags.length} saved to scripts/tags.json`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
