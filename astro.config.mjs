// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://sreeraj.dev',
  output: 'static',
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      langs: ['python', 'bash', 'java', 'dockerfile', 'yaml', 'toml', 'hcl', 'json', 'javascript', 'typescript', 'sql', 'go', 'text'],
    },
  },
});
