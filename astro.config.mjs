import { defineConfig } from 'astro/config';

// Centralized default backdrop path - single source of truth
const DEFAULT_BACKDROP = '/backdrops/SkyDarkTall.pm';

export default defineConfig({
  site: 'https://debian.com.mx',
  vite: {
    define: {
      'import.meta.env.PUBLIC_APP_VERSION': JSON.stringify(process.env.npm_package_version),
      'import.meta.env.DEFAULT_BACKDROP': JSON.stringify(DEFAULT_BACKDROP),
    },
  },
});
