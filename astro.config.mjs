import { defineConfig } from 'astro/config';

// On GitHub Pages the site lives at https://<user>.github.io/<repo>/, so the workflow
// passes SITE_URL and BASE_PATH. Locally both are unset and the site is served from /.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH || '/',
});
