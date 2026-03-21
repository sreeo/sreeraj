You are rebuilding sreeraj.dev — a personal tech blog built with Astro 5.

## Your Mission

Completely redesign and rebuild the presentation layer of sreeraj.dev in the style of: **{{TREND}}**

You must generate ALL layout, component, page, and style files from scratch. The content (blog posts, images) stays as-is — you are only rebuilding how it looks and feels.

## Design Quality Bar

You are not building a template. You are building a site that could win an Awwwards honorable mention. Study the reference style carefully and capture its structural DNA — not just its colors.

**What separates great from mediocre:**

### Typography
- Use a deliberate type scale (not random sizes). Define 5-7 sizes that relate mathematically.
- Headings should have negative letter-spacing (-0.02 to -0.04em). Body text should have generous line-height (1.7-1.9).
- Pick weights intentionally: 400 for body, 500-600 for subheads, 700-800 for headlines. Never use more than 3 weights.
- Meta text (dates, reading time, tags) should be distinctly smaller and lighter — clearly secondary.

### Spacing & Rhythm
- Use a spacing scale based on a ratio (e.g., 4, 8, 16, 24, 32, 48, 64, 96px). Never use arbitrary values.
- Sections should have LARGE vertical padding (80-120px on desktop). This is what makes a site feel premium.
- Cards should have comfortable internal padding (20-32px) and consistent gaps between them.
- The homepage should breathe — don't cram everything together.

### Layout
- The homepage should have a distinctive layout — not just a grid of cards. Consider: a featured post hero, a curated section, or a unique content arrangement that matches the design style.
- Blog post pages should be optimized for reading: 680-720px max-width, generous margins, comfortable paragraph spacing.
- Navigation should feel intentional and match the style (minimal for minimal styles, bold for bold styles).

### Visual Polish
- Hover states on EVERY interactive element — links, cards, buttons, nav items. Each hover should feel satisfying.
- Transitions should be 200-300ms with ease-out. Never instant, never slow.
- Cards should have subtle depth (shadow, border, or background shift) that increases on hover.
- Images in post cards should have consistent aspect ratios and subtle treatments (rounded corners, border, or shadow).
- Use CSS background effects that match the style: subtle gradients, grid patterns, noise textures, or geometric accents.

### Color
- Use a restrained palette: 1 accent, 1 background, 1 surface, 2-3 text shades, 1 border color.
- Accent color for interactive elements only (links, active states, tags). Never for body text.
- Ensure minimum 4.5:1 contrast on all text. Muted text should still be easily readable.
- Dark themes: text should be #e2e8f0 range (not pure white). Background should be #0f1729 range (not pure black).
- Light themes: text should be #1a1a1a range (not pure black). Background should be #fafafa range (not pure white).

### What Makes Sites Look Amateur (AVOID)
- Pure black (#000) text on pure white (#fff) background
- Random spacing with no consistent scale
- Headings and body text too close in size
- No hover states
- Cards with no depth or visual separation
- Cluttered homepage with no visual hierarchy
- Generic "blog template" feel — grid of identical cards with no featured content
- Borders that are too heavy (>1px for most elements)
- Drop shadows that are too dark or too large

## Reference Sites for Quality Bar

Study these for structural quality (not to copy, but to match the caliber):
- **stripe.com** — typography, spacing, scroll animations
- **linear.app** — minimal design with perfect interactions
- **vercel.com** — clean layout, excellent type hierarchy
- **apple.com** — whitespace mastery, product storytelling
- **pentagram.com** — bold editorial design
- **rauno.me** — personal site with exceptional craft

---

## Content Schema

Blog posts are in `src/content/blog/*.md` with this frontmatter:
```
title: string (required)
slug: string (required)
description: string (default: '')
pubDate: date (required)
updatedDate: date (optional)
featured: boolean (default: false)
featureImage: string (default: '')
tags: string[] (default: [])
author: string (default: 'Sreeraj')
readingTime: number (default: 1)
trekStats: (optional)
  elevation, distance, duration, difficulty, basecamp, season: string
  startAlt, peakAlt: number
```

Pages are in `src/content/pages/*.md`:
```
title: string (required)
slug: string (required)
featureImage: string (default: '')
```

## Astro Patterns (MUST follow these exactly)

### Getting blog posts:
```astro
---
import { getCollection } from 'astro:content';
const posts = (await getCollection('blog'))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---
```

### Getting a page:
```astro
---
import { getCollection } from 'astro:content';
const pages = await getCollection('pages');
const about = pages.find(p => p.data.slug === 'about');
---
```

### Rendering markdown content:
```astro
---
const { Content } = await post.render();
---
<Content />
```

### Dynamic blog post route (`src/pages/[...slug].astro`):
```astro
---
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.data.slug },
    props: post,
  }));
}

const post = Astro.props;
const { Content } = await post.render();
---
```

### Dynamic tag route (`src/pages/tags/[tag].astro`):
```astro
---
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  const tags = [...new Set(posts.flatMap(p => p.data.tags))];
  return tags.map(tag => ({
    params: { tag },
    props: { posts: posts.filter(p => p.data.tags.includes(tag)), tag },
  }));
}

const { posts, tag } = Astro.props;
---
```

### Category filter pages (devops, treks, programming, postgres):
```astro
---
import { getCollection } from 'astro:content';
const posts = (await getCollection('blog'))
  .filter(p => p.data.tags.includes('devops'))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---
```

### Theme detection:
```typescript
// src/utils/theme.ts
const TREK_TAGS = ['treks', 'trek'];
export function getThemeForTags(tags: string[]): 'tech' | 'trek' {
  return tags.some(t => TREK_TAGS.includes(t)) ? 'trek' : 'tech';
}
```

### Tailwind CSS 4:
The CSS file must start with `@import "tailwindcss";` and use a `@theme { }` block for CSS custom properties. Tailwind utility classes work in templates.

## Required Routes

| Route | File | Data needed |
|-------|------|------------|
| `/` | `src/pages/index.astro` | All posts, featured posts |
| `/about/` | `src/pages/about.astro` | about page from pages collection |
| `/contact/` | `src/pages/contact.astro` | contact page from pages collection |
| `/{slug}/` | `src/pages/[...slug].astro` | Individual blog post |
| `/devops/` | `src/pages/devops.astro` | Posts tagged 'devops' |
| `/treks/` | `src/pages/treks.astro` | Posts tagged 'treks' or 'trek' |
| `/programming/` | `src/pages/programming.astro` | Posts tagged 'programming' |
| `/postgres/` | `src/pages/postgres.astro` | Posts tagged 'postgres' |
| `/tags/` | `src/pages/tags/index.astro` | All unique tags |
| `/tags/{tag}/` | `src/pages/tags/[tag].astro` | Posts for specific tag |
| `/archive/` | `src/pages/archive/index.astro` | Read public/archive/registry.json |
| `/404` | `src/pages/404.astro` | None |
| `/rss.xml` | `src/pages/rss.xml.ts` | All posts for RSS feed |

## Required Components

| Component | Purpose |
|-----------|---------|
| `src/layouts/BaseLayout.astro` | Root layout: html, head, body, nav, footer, slot |
| `src/layouts/PostLayout.astro` | Blog post layout: title, meta, content, prev/next nav |
| `src/layouts/TagLayout.astro` | Tag/category listing: heading + post grid |
| `src/components/BaseHead.astro` | SEO meta tags, fonts, analytics script |
| `src/components/Header.astro` | Navigation (Home, About, DevOps, Treks, Programming, Postgres, Archive) |
| `src/components/Footer.astro` | Site footer |
| `src/components/PostCard.astro` | Blog post preview card |
| `src/components/FormattedDate.astro` | Date formatting utility |
| `src/components/TagList.astro` | Renders tag pills |

## Required in BaseHead.astro

```html
<script defer src="https://cloud.umami.is/script.js" data-website-id="057ff310-3cdd-46d1-9862-aabd77ec1613"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
<link rel="alternate" type="application/rss+xml" title="sreeraj.dev" href="/rss.xml" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

You may add additional Google Fonts if the design calls for it.

## Archive Page

`src/pages/archive/index.astro` must read `public/archive/registry.json`:
```astro
---
import registryData from '../../../public/archive/registry.json';
const archives = registryData.archives || [];
---
```
Each entry has: `{ month, trend, description, primaryColor, deployedAt }`. Link to `/archive/{month}/`.

## RSS Feed

Copy this exactly to `src/pages/rss.xml.ts`:
```typescript
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: 'sreeraj.dev',
    description: 'DevOps, Programming, and Treks',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/${post.data.slug}/`,
    })),
  });
}
```

## What NOT to Touch

- `src/content/**`, `src/content.config.ts` — content
- `astro.config.mjs`, `package.json` — config
- `public/images/**`, `public/archive/**`, `public/CNAME`, `public/favicon.*` — assets
- `automation/**`, `.github/**` — tooling

## Your Process

1. Read `src/content.config.ts`, `astro.config.mjs`, a few blog posts, and `public/archive/registry.json`
2. Think carefully about the design system: type scale, spacing scale, color palette, interaction patterns
3. Generate `src/styles/global.css` first — this is the design foundation
4. Generate layouts, then components, then pages
5. Run `npm run build` and fix any errors
6. Keep iterating until `npm run build` succeeds with 0 errors
7. Write `src/data/design-manifest.json`:
```json
{
  "trend": "Design style name",
  "description": "Brief description",
  "primaryColor": "#hex",
  "fonts": ["Font1", "Font2"]
}
```

## Success Criteria

- `npm run build` completes with 0 errors
- All 19 blog posts accessible at their slugs
- The homepage has a distinctive layout (not just a generic card grid)
- Blog posts are comfortable to read (proper max-width, line-height, spacing)
- Every interactive element has a hover state
- The design is cohesive — every element feels like it belongs to the same system
- A designer would look at this and say "this was made with care"
