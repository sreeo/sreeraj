You are rebuilding sreeraj.dev — a personal tech blog built with Astro 5.

## Your Mission

Completely redesign and rebuild the presentation layer of sreeraj.dev in the style of: **{{TREND}}**

You must generate ALL layout, component, page, and style files from scratch. The content (blog posts, images) stays as-is — you are only rebuilding how it looks and feels.

## Design Philosophy

- **READABILITY IS #1** — body text must be effortless to read. Dark text on light bg or light text on dark bg. Minimum 4.5:1 contrast ratio.
- **Structure over decoration** — great design is about layout, typography, spacing, and hierarchy. Not about flashy colors.
- **Both themes should feel unified** — tech and trek themes use the same design language, just different accent colors.
- **Responsive** — must work on mobile (320px+) through desktop.
- **Respect `prefers-reduced-motion`** — disable animations for users who prefer it.

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

### CSS imports:
```astro
---
import '../styles/global.css';
---
```

### Tailwind CSS 4:
The CSS file must start with `@import "tailwindcss";` and use a `@theme { }` block for CSS custom properties. Tailwind utility classes work in templates.

## Required Routes

You MUST create pages for ALL of these routes:

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
| `src/components/Header.astro` | Navigation bar with links to all sections + Archive |
| `src/components/Footer.astro` | Site footer |
| `src/components/PostCard.astro` | Blog post preview card (title, date, tags, image, description) |
| `src/components/FormattedDate.astro` | Date formatting utility |
| `src/components/TagList.astro` | Renders a list of tag pills |

## Required in BaseHead.astro

```html
<!-- Analytics (MUST include) -->
<script defer src="https://cloud.umami.is/script.js" data-website-id="057ff310-3cdd-46d1-9862-aabd77ec1613"></script>

<!-- Fonts (MUST include Inter, JetBrains Mono, Lora — can add more) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />

<!-- RSS -->
<link rel="alternate" type="application/rss+xml" title="sreeraj.dev" href="/rss.xml" />

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

## Archive Page

The archive page at `src/pages/archive/index.astro` must read `public/archive/registry.json`:

```astro
---
import registryData from '../../../public/archive/registry.json';
const archives = registryData.archives || [];
---
```

Each archive entry has: `{ month, trend, description, primaryColor, deployedAt }`.
Render them as cards linking to `/archive/{month}/`.

## RSS Feed

`src/pages/rss.xml.ts`:
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

- `src/content/**` — blog posts and pages (content)
- `src/content.config.ts` — content schema
- `astro.config.mjs` — build config
- `public/images/**` — image assets
- `public/archive/**` — archived designs
- `public/CNAME`, `public/favicon.*` — domain and favicon
- `package.json`, `package-lock.json` — dependencies
- `automation/**` — automation scripts
- `.github/**` — workflows

## Your Process

1. First, read `src/content.config.ts` and `astro.config.mjs` to understand the setup
2. Read a few blog posts to understand the content structure
3. Read `public/archive/registry.json` to understand archive data
4. Design your approach — think about the layout, typography, and visual system
5. Generate `src/styles/global.css` first (the design foundation)
6. Generate layouts (BaseLayout, PostLayout, TagLayout)
7. Generate components (BaseHead, Header, Footer, PostCard, FormattedDate, TagList)
8. Generate all pages
9. Generate `src/utils/theme.ts`
10. Run `npm run build` to check for errors
11. Fix any errors and rebuild
12. Keep iterating until the build is clean
13. Write `src/data/design-manifest.json` with info about the design you created

## design-manifest.json format:
```json
{
  "trend": "Name of the design style",
  "description": "Brief description of the design approach",
  "primaryColor": "#hex",
  "fonts": ["Font1", "Font2"]
}
```

## Success Criteria

- `npm run build` completes with 0 errors
- All 19 blog posts are accessible
- All category pages work
- Archive page renders
- Navigation works across all pages
- Design is readable, responsive, and visually cohesive
- The site looks like a professional, cutting-edge personal blog
