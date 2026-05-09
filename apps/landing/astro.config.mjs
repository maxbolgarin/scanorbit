import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

// SITE_URL lets the GitHub Pages workflow inject the custom domain at build time
// (e.g. https://scanorbit.example). Defaults to the canonical custom domain so
// `astro build` works for local previews.
const site = process.env.SITE_URL || 'https://scanorbit.cloud';

export default defineConfig({
  site,
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
