import { defineConfig, envField } from 'astro/config';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

// Every page is a static shell; its Svelte island talks to Supabase from the
// browser with the publishable key (RLS is the boundary). Only the routes in
// src/pages/api/ run on the server, because they hold the Gemini key.
export default defineConfig({
  site: 'https://oresama-sensei.vercel.app',
  output: 'static',
  adapter: vercel(),
  integrations: [svelte()],
  // Hover/focus prefetch only — the shells are static, so this is cheap.
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // The Next.js app's routes. The installed home-screen app still opens /chat
  // (its manifest is cached on the phone until it is re-added), so these must
  // keep resolving.
  redirects: {
    '/review': '/',
    '/chat': '/',
    '/dashboard': '/',
    '/insights': '/',
    '/tests': '/',
    '/lessons': '/',
    '/books': '/',
    '/map': '/',
    '/sns': '/',
    '/library': '/words',
    '/search': '/words',
  },
  env: {
    schema: {
      GEMINI_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      PIXABAY_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    // NEXT_PUBLIC_* is what the Vercel project already has set (it was a Next.js
    // app); PUBLIC_* is Astro's own. Either reaches the browser.
    envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'],
  },
});
