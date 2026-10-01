# v5 lean rewrite — work in progress

Branch `feat/astro-lean`. **Not deployable yet** — the pages and islands are not written.
`main` is still the working Next.js app; the last Next.js version is also tagged `nextjs-v4.4`.

## Decisions (owner, 2026-10-01)

- Rewrite in **Astro + Svelte 5**, same stack and design system as `../pressroom`
  ("Editorial FUI": ink default, cream proof-sheet paper, Fraunces / Space Grotesk / JetBrains
  Mono, cobalt `#2742f0` + amber `#e8a31a`, MV motion, cross-document View Transitions).
  No GSAP, Lenis, React, Framer or Anthropic SDK.
- Usage data (Supabase, 2026-10-01): only flashcards are still used (4,302 grades, last 2026-09-24);
  nothing else since 2026-07-12. **Keep:** flashcards (with pictures, pitch accent, kanji
  breakdown + TTS, Ask Sensei), word list/search, kanji browser, quick-add.
  **Drop:** chat, photo→lesson, SNS, tests, map, books, insights, dashboard.
- Database is untouched (no migration, no dropped tables). Hisho still reads it.

## Done

- `scripts/lib/shards.mjs` + both data build scripts → `public/data/` shards
  (pitch: 256 FNV-1a buckets, ~6 KB gz each, was one 4.4 MB chunk; kanji strokes: 64 buckets;
  kanji info per level). Level lists bundled in `src/data/kanji-levels.json`.
- Config: `package.json`, `astro.config.mjs` (static + Vercel adapter, old-route redirects,
  `astro:env` secrets, `envPrefix` accepts the existing `NEXT_PUBLIC_*` vars), `tsconfig.json`,
  `.gitignore`, `.env.example`. Latin fonts copied from pressroom.
- `src/lib/`: supabase (browser client, `requireUser`, `api()` with bearer token, `fetchAllRows`),
  srs (FSRS, now client-side), study-day, pace, review-queue (degradation probes removed — 0024 is
  live), mastery (CSS-var colours), furigana, ruby segments, safe markdown renderer, pitch (shards),
  kanji (shards), conjugation, prefs (runes), sound, outbox (persistent grade queue with Web Lock),
  due (header badge cache), images (WebP encode + upload under RLS), types.
- `src/server/`: gemini (REST: structured / stream / embed), auth (verify bearer → user-scoped client),
  prompts (Ask, quick-add draft, kanji mnemonic), items (dedupe + embed + insert).
- `src/pages/api/`: ask, draft, words, mnemonic, image-search, image-fetch.

## To do

1. Styles: `src/styles/{fonts,global,mv}.css` (port the subset of pressroom's tokens/utilities;
   JP text uses system mincho/gothic stacks, not webfont subsets).
2. `src/layouts/Base.astro`: head, PWA meta, inline auth guard (localStorage `sb-*-auth-token`
   → `/login`), topbar 俺様先生 · REVIEW (badge) · WORDS · KANJI · settings.
3. Svelte islands: Review (queue, session resume, keys, grade → outbox, flash/strike, details,
   park, note, study-ahead, `?over=1`, `?item=`), shared (Ruby, Speak, Pitch, Conjugation,
   ItemImage + DrawPad + WebImages, AskSensei, DueBadge), Words (+ AddWord), KanjiBrowser,
   KanjiDetail (+ StrokeOrder, mnemonic), Settings, Login.
4. Pages: `/`, `/words`, `/kanji`, `/kanji/view?c=`, `/settings`, `/login`, `404`.
5. `public/manifest.webmanifest` (start_url `/`), icons (generate PNGs), favicon.
6. Tests (vitest): study-day, interleave, pitch shard parity with the script, markdown escaping,
   ruby segments, conjugation.
7. Rewrite `CLAUDE.md` + `README.md` for v5; delete this file.
8. `npm run build`, browser-check against the real DB, then merge to `main` (Vercel deploys).
   Vercel env already has `NEXT_PUBLIC_SUPABASE_*` + `GEMINI_API_KEY`; the project's framework
   preset may need switching from Next.js to Astro.
