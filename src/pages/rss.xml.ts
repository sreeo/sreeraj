import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: string }) {
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
