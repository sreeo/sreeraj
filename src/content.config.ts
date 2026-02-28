import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    featureImage: z.string().default(''),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Sreeraj'),
    readingTime: z.number().default(1),
    // Trek-specific fields
    trekStats: z.object({
      elevation: z.string().optional(),
      distance: z.string().optional(),
      duration: z.string().optional(),
      difficulty: z.string().optional(),
      basecamp: z.string().optional(),
      season: z.string().optional(),
      startAlt: z.number().optional(),
      peakAlt: z.number().optional(),
    }).optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    featureImage: z.string().default(''),
  }),
});

export const collections = { blog, pages };
