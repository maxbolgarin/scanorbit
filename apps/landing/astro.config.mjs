import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://scanorbit.io',
  output: 'static',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
