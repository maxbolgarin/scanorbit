import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

// Override via env when deploying to a custom domain.
// Default targets the GitHub Pages project URL: https://maxbolgarin.github.io/scanorbit
const site = process.env.SITE || 'https://maxbolgarin.github.io';
const base = process.env.BASE ?? '/scanorbit';

export default defineConfig({
  site,
  base,
  output: 'static',
  integrations: [icon(), sitemap()],
  build: {
    assets: '_assets',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: true,
    },
  },
});
