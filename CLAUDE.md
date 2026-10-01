# 俺様先生 (oresama-sensei) — Project Brief for AI Agents

> **Read this first.** What this is, who it's for, and how to work on it.
> **Keep it updated:** when you make a meaningful change or decision, edit the relevant section
> (especially "Status" and "Decisions") in the same commit.

## What this is
A **private, single-user web app** for studying Japanese toward **JLPT N2–N1**. Since v5 it does
four things, all built around spaced-repetition flashcards:

1. **Review** (`/`) — today's flashcards, FSRS-scheduled, with a daily budget.
2. **Words** (`/words`) — every saved word, searchable (kanji/kana/rōmaji/English), plus quick-add.
3. **Kanji** (`/kanji`, `/kanji/view?c=字`) — the 2,211 JLPT kanji: stroke order, readings, parts,
   personal mnemonics, coverage.
4. **Settings** (`/settings`) — profile (shapes Sensei's examples), study pace, device prefs.

Everything else from v4 (chat tutor, photo→lesson, SNS helper, tests, map, books, insights,
dashboard) was **dropped on purpose** — usage data on 2026-10-01 showed only flashcards were still
used (4,302 grades; nothing else since 2026-07-12). The last Next.js version is tag **`nextjs-v4.4`**.
**The database was not changed** — the old tables are still there and Hisho still reads them.

## Who it's for
- Thai, 30, a **manga-style artist** active on X with Japanese artists; background in
  **English-language teaching** and **Data Science**.
- Prefers **meaningful learning** — contextual examples, nuance, real life — over rote.
- **Not** a web developer: keep explanations friendly and concrete; do the work rather than hand back
  to-do lists.

## Stack
**Astro 7 (static shells) + Svelte 5 islands + supabase-js in the browser**, hosted on **Vercel**.
Same stack and design system as `../pressroom`. No React, Next.js, Tailwind, GSAP, Lenis, Framer or
Anthropic SDK.

- Every page is a **static shell** (`src/pages/*.astro`) with one `client:only="svelte"` island.
  The island signs in (`requireUser()`), reads/writes Supabase **under RLS with the publishable key**,
  and renders. There is no server-side rendering of user data.
- **Only `src/pages/api/*` run on the server** (`prerender = false`), because they hold the Gemini
  key. Each verifies the browser's bearer token and acts as the user under RLS (`src/server/auth.ts`).
  There is **no service-role key** anywhere.
  - `POST /api/ask` — Ask Sensei (streams text). `POST /api/draft` — quick-add drafts a card (writes
    nothing). `POST /api/words` — save a card (embeds it). `POST /api/mnemonic` — kanji mnemonic +
    2–3 example words (cached per user in `kanji`). `GET /api/image-search` / `image-fetch` — pictures
    for cards (Pixabay → Openverse, no AI).
- **AI is Gemini only** (`gemini-2.5-flash`, `gemini-embedding-001`) over plain REST
  (`src/server/gemini.ts`). Prompts are in `src/server/prompts.ts` — carried over from v4 and tuned;
  change them deliberately.
- Old routes (`/review`, `/chat`, `/library`, …) **301 to their v5 home** (`astro.config.mjs`),
  because an installed home-screen app keeps its old start URL until it's re-added.

## Key files
- `src/components/review/Review.svelte` — the flashcard screen (the heart of the app).
- `src/lib/review-queue.ts` — today's queue + budget. `src/lib/study-day.ts` — when a day rolls over.
  `src/lib/pace.ts` — the learner's budget from `profiles`.
- `src/lib/srs.ts` — FSRS (`ts-fsrs`), **runs in the browser**. `src/lib/outbox.ts` — persistent grade
  queue. `src/lib/review-session.ts` — resume a batch. `src/lib/review-keys.ts` — keyboard grading.
- `src/lib/due.ts` — the header badge. `src/lib/images.ts` — pictures (re-encode, upload, sign).
- `src/components/shared/` — Ruby, Pitch, Speak, Conjugation, KanjiChips, ItemImage (+ DrawPad,
  WebImages), AskSensei, Modal, Icon.
- `src/layouts/Base.astro` — head, PWA meta, the inline **auth guard** and tone script, the topbar.
- `src/styles/global.css` (tokens — the only place they live), `mv.css` (motion), `fonts.css`.

## Running it
1. `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (or the `PUBLIC_SUPABASE_*` names), `GEMINI_API_KEY`, optional `PIXABAY_KEY`. See `.env.example`.
   Without `GEMINI_API_KEY`, Ask Sensei / quick-add drafts / mnemonics fail; everything else works.
2. `npm install` → `npm run dev` → http://localhost:4321.
3. `npm run check` (astro check + svelte-check), `npm test` (vitest), `npm run build`.
4. Database: run `supabase/migrations/` 0001–0024 in order (all already applied to the live project).

### Supabase MCP (optional, for AI agents)
`.mcp.json` wires Claude Code to the hosted Supabase MCP, scoped to this project and **read-only**.
Needs `SUPABASE_ACCESS_TOKEN` in the environment (never in git). Drop `read_only=true` from the URL
temporarily to let an agent apply a migration.

## Shared database with Hisho (since 2026-07-16)
The same Supabase project hosts **Hisho** (`../hisho`, `asu-azure/hisho`). Its tables are prefixed
**`hisho_`**, managed by Hisho's own migrations, and must never be modified from here. Hisho reads this
app's `review_log` / `knowledge_items` **read-only**. So: keep writing `review_log` exactly as before,
and keep new `knowledge_items` embedded (the `match_knowledge` RPC and Hisho expect it).

## Working across computers
Data lives in Supabase; only code syncs via GitHub. `npm run pull` at the start, `npm run sync` (pull,
timestamped commit, push) when done.

## Design system ("Editorial FUI", from pressroom)
- **Ink is the default tone**; **Paper** (cream proof-sheet stock) is a per-device choice in Settings
  (`html[data-tone='paper']`, set before first paint). `.spread--paper` flips any section — the
  flashcard is always a cream proof sheet with crop marks.
- Serif narrates (Fraunces), grotesk punches (Space Grotesk), mono labels (JetBrains Mono). **Japanese
  uses system mincho/gothic stacks, never a webfont subset** — the words come from the database and can
  contain any kanji.
- One cobalt accent `#2742f0` (lifted to `--accent-text` on ink), sunflower amber `#e8a31a` as the
  warm counterpoint. Mastery, pitch-type and rating colours are tokens too.
- Motion: MV vocabulary (`mv.css` + `src/lib/mv.ts`): `converge` (RGB split) on headings and the card
  term, `strike` rings on button presses, a short glitch cut before the page wipe. Page changes are
  cross-document **View Transitions** (no router). Everything ≤ 600 ms and lands on its final state under
  `prefers-reduced-motion`. **No custom cursor, no magnetic buttons, no smooth-scroll library** — the
  same rules as pressroom.

## Conventions
- TypeScript strict. Svelte 5 runes. Islands are `client:only`, so `location`/`localStorage` are safe in
  component scripts.
- Furigana: `<ruby>漢字<rt>かんじ</rt></ruby>` or 漢字（かんじ） in data; render short strings with
  `Ruby.svelte` (builds elements, never HTML) and model output with `renderMarkdown()` (escapes
  everything first; ruby is rebuilt from escaped parts). Never `{@html}` anything else.
- Full-list queries page past PostgREST's 1,000-row cap with `fetchAllRows` and a **stable order**
  (`id` as tiebreaker).
- Embeddings are 768-dim, L2-normalised (`EMBED_DIM` in `src/server/gemini.ts`).
- Offline data is **sharded** in `public/data/` (layout in `scripts/lib/shards.mjs`; the client halves
  are `src/lib/pitch.ts` and `src/lib/kanji.ts` — change both together; `shards.test.ts` checks parity).
  `npm run kanji:build` / `npm run pitch:build` regenerate it. Credits: KanjiVG (CC BY-SA 3.0),
  kanji-data (MIT), kanjium (CC BY-SA 4.0) — shown on the kanji page and by the Pitch toggle.

## Status
- ✅ **v5.0** (2026-10-01/02) — the lean rewrite: Astro + Svelte 5, flashcards first. Review with the
  v4.4 daily budget, keyboard grading (Space / 1–4 / S / D / N / ? / Esc), park, notes, pictures,
  pitch accent, conjugation, kanji breakdown, Ask Sensei with "save to note", study-ahead and `?over=1`;
  Words with fuzzy search, mastery filters and quick-add; Kanji browser with coverage and bulk
  mark-learned; kanji detail with stroke order and mnemonics; Settings (profile, pace, tone, sound,
  pitch, sign out); PWA manifest + icons; vitest suite.
- ⏳ Ideas: Anki export; a "learning" chip that isn't always empty (every low-stability word is
  currently "struggling" by the lapses/difficulty rule — see `lib/mastery.ts`); offline review
  (the outbox already survives offline grading; the queue still needs a connection to load).

## Decisions
- **v5 is a lean rewrite, not a port.** Only what was actually used survives. The old app is
  `nextjs-v4.4`; the old look is `aesthetic/pop-art-v1`. Restore from those, not from memory.
- **Grading happens in the browser and goes through the outbox.** FSRS runs client-side; each grade is
  appended to localStorage first and flushed in order under a Web Lock, so a dropped connection never
  loses a review and the next card never waits on the network. A fresh queue first awaits `flush()` and
  skips items whose update hasn't landed (`pendingItemIds()`), and subtracts pending grades from
  today's count.
- **The visible "due" number is today's budgeted workload, not the lifetime pile — and we cap the
  display, never rewrite `srs_due`.** A bulk "postpone" would feed FSRS a false elapsed time, which is
  the signal it is fitted on. The backlog is shown once, quietly, with a "~N days at this pace" estimate.
  **No streak**: it would turn a missed day into a punishment.
- `review_log.stability_before IS NULL` marks a card's first-ever review — that's how "new cards
  introduced today" is counted, with no extra column. Keep writing it as `srs_stability ?? null`.
- Single-user auth (RLS needs a user). The inline guard in `Base.astro` only checks that a session key
  exists — UX, not security; `requireUser()` catches a session that can't refresh.
- Pictures are re-encoded in the browser (≤1280 px WebP, JPEG on Safari) before upload, so no Storage
  image transform is needed; signed URLs are batched and cached (`signPaths`).
- Mastery is derived from FSRS state (`lib/mastery.ts`); nothing extra is stored.
- TTS is the browser's Web Speech API (ja-JP) — free.
