@AGENTS.md

# 俺様先生 (oresama-sensei) — Project Brief for AI Agents

> **Read this first.** It explains what this project is, who it's for, and how to work on it.
> **Keep it updated:** whenever you make a meaningful change or decision, edit the relevant
> section below (especially "Status & Roadmap" and "Decisions log") in the same commit.

## What this is
A **private, single-user web app** that helps the owner study Japanese toward **JLPT N2–N1**.
Two core features:
1. **AI chat with persistent memory** — a tutor that answers questions about grammar,
   vocabulary, and usage, and **remembers everything** across sessions (it builds a personal
   knowledge base and recalls it to personalize and avoid re-teaching).
2. **Photo → lesson** — the owner photographs a book/manga page; the app reads it (OCR) and
   writes a meaningful, personalized lesson.

## Who it's for (the owner)
- Thai, age 30, a **manga-style artist** active on X with Japanese artists; wants to belong in
  that community and converse naturally.
- Has a background in **English-language teaching** and **Data Science**.
- Strongly prefers **meaningful learning** — lots of contextual examples, nuance, and things
  tied to real life — over rote memorization. Lessons should be vivid and memorable.
- Is **not** a web developer; keep explanations friendly and concrete. Default to doing the
  work rather than handing back long to-do lists.

## How it works (architecture)
- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind v4 + Framer Motion. Hosted on
  **Vercel**; code on GitHub (`asu-azure/oresama-sensei`).
- **Supabase** — Auth (single account), Postgres + **pgvector**, Storage. All data is scoped to
  the user via **RLS**; the app uses the user session (no service-role key).
- **Claude** (`claude-sonnet-4-6`; `claude-opus-4-8` for "deep" lessons) — chat answers, lesson
  writing, and structured knowledge extraction.
- **Gemini** (`gemini-2.5-flash` for OCR, `gemini-embedding-001` for embeddings) — reads photos
  and powers vector search. Hybrid setup chosen because Gemini is best/cheapest at Japanese OCR
  and gives native embeddings, while Claude writes the best pedagogy.
- **The "memory" feature** = RAG: text is embedded (Gemini) → stored in pgvector → most relevant
  past items are injected into Claude's system prompt. New items are **deduplicated** by cosine
  similarity (re-asking bumps `times_seen` instead of duplicating). See `src/lib/memory.ts` and
  the `match_knowledge` SQL function.

## Key files
- `src/app/api/chat/route.ts` — chat pipeline (recall → stream Claude → extract+store).
- `src/app/api/lesson/route.ts` — OCR (Gemini) → write lesson (Claude) → save + extract.
- `src/lib/claude.ts`, `src/lib/gemini.ts` — model clients (lazy, with Gemini retry/backoff).
- `src/lib/memory.ts` — embed, recall, dedupe-insert.
- `src/lib/prompts.ts` — the pedagogy system prompts (the heart of teaching quality).
- `src/lib/supabase/{client,server,middleware}.ts` + `src/proxy.ts` — auth/session.
- `supabase/migrations/0001_init.sql` — schema, pgvector, RLS, `match_knowledge`, storage, profile trigger.

## Running it
1. Supabase project → run the SQL files in `supabase/migrations/` (0001–0009) in order in the SQL editor.
2. `.env.local` (NOT committed) with: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`. See `.env.example`.
3. `npm install` → `npm run dev` → http://localhost:3000. Restart dev after editing `.env.local`
   (Next reads env only at startup).

## Working across computers (IMPORTANT)
The **data lives in Supabase (cloud)**, so chats/vocab/lessons sync automatically. Only the
**code** syncs via GitHub. Workflow:
- **Start of a session:** `npm run pull` (get the latest).
- **When done / periodically:** `npm run sync` (pulls, commits with a timestamp, pushes).
- On a new computer: install Node + Git → `git clone https://github.com/asu-azure/oresama-sensei.git`
  → `npm install` → recreate `.env.local` (keep keys in a password manager) → `npm run dev`.

## Conventions
- TypeScript strict; path alias `@/*` → `src/*`.
- Tailwind v4 (CSS-first; tokens in `src/app/globals.css`).
- Furigana is rendered as `<ruby>漢字<rt>かんじ</rt></ruby>` (allowed through sanitization in
  `src/components/markdown.tsx`); prompts instruct Claude to use it.
- Embeddings are 768-dim and L2-normalized (pgvector index limit). Keep schema dim in sync with
  `EMBED_DIM` in `src/lib/gemini.ts`.

## Status & roadmap
- ✅ v1 shipped: auth, chat-with-memory, photo→lesson, settings/profile.
- ✅ v2 shipped: chat history windowing + past-chats drawer; **vocab/grammar library**
  (`/library`) color-coded by SRS mastery; richer **practice exercises** (multiple-choice,
  sentence-arrangement, fill-in-the-blank) generated per-lesson and as on-demand review tests.
- ✅ v2.1 shipped: TTS pronunciation (browser Web Speech API) in library/flashcards;
  library → single-item review (`/review?item=`) + due-count badge on the Review nav;
  conversation rename/delete in the chat drawer; furigana now renders in exercise options/tokens;
  map/library/flashcards hide redundant kana readings; tasteful tap/entrance animations (reduced-motion aware).
- ✅ v2.2 shipped (mobile/PWA polish): proper `viewport` export (fixes iOS "zoomed in") +
  `viewportFit: cover` with `env(safe-area-inset-*)`; installable **PWA** — `app/manifest.ts`
  (`scope:"/"`, `display:standalone`, `start_url:/chat`) + `appleWebApp` meta, which fixes the iOS
  home-screen app opening every tab in a hovering Safari overlay; generated app icons
  (`app/icon.tsx`, `app/apple-icon.tsx`, `app/icons/{192,512}`, art in `src/lib/icon-art.tsx`);
  `loading.tsx` skeletons on `/library`, `/dashboard`, `/map` so tab switches paint instantly;
  header title 俺様先生 no longer wraps (scrollable tab strip). **Library redesigned**: GitHub-style
  calendar heat-map (`library-calendar.tsx`) that filters the list by day; compact rows (term + mastery
  dot) that expand on tap; initial fetch trimmed from 2000 → 150 with infinite scroll (`actions.ts`
  `loadMoreItems`/`loadItemsForDay`).
- ✅ v2.3 shipped (interactive map): the `/map` **Graph** view is now draggable (React Flow used
  uncontrolled via `defaultNodes`/`defaultEdges`; drags persist into `knowledge_maps.data.positions`
  via `map/actions.ts` `saveMapPositions`, debounced). Layout no longer overlaps — ring radius +
  grid spacing scale with item count and nodes size to content. Tapping a node (or a Board row)
  opens a detail panel with **Practice this** (`/review?item=`) and **Lessons mentioning this**
  (`findLessonsForTerm`, an `ilike` text search since items have no lesson FK).
- ✅ v2.4 shipped (search + test bank + richer prompts): new **Search** tab (`/search`) — live,
  no-Enter lookup over saved items by kanji/kana/**rōmaji**/English with typo tolerance (`fuse.js`
  + `wanakana`, all client-side) plus a debounced lesson text-search (`search/actions.ts`); new
  **Tests** tab (`/tests`) — a saved **test bank** (table `review_tests`, migration **0006**) with a
  scope picker (Struggling / New / Due / by level+type, counts from SQL = $0) that generates once and
  **replays for free** (`/api/tests`, `/api/tests/[id]`); Review is now flashcards-only and links to
  Tests (old `/api/review-test` deleted). `arrange` exercises are now the JLPT **★ 並べ替え** format
  (context sentence with four blanks, one ★; drag **or** tap to place via `@dnd-kit/core`; graded on
  the ★ slot) — see `ArrangeExercise.star_index`, the `{{BLANKS}}` marker, and `StarArrangeView`.
  Prompts enriched in `lib/prompts.ts` (`LEARNER_CONTEXT` + `CONTEXT_VARIETY`) so answers reflect the
  full learner profile (manga + English-teaching + music + world news) and span authentic JLPT topics.
- ✅ v2.5 **Stage A** shipped (kanji): new **Kanji** tab (`/kanji`) — browse the full **JLPT N5–N1**
  set (2211 kanji) with **stroke-order animation**, on/kun **readings + meanings + JLPT/strokes**, and
  **component/radical breakdown** (tappable to drill in); kanji from your saved words are badged, and
  each card lists your words containing it. **Offline**: data is bundled in `src/data/kanji/*`
  (built by `scripts/build-kanji-data.mjs`, `npm run kanji:build`) from **KanjiVG** (CC-BY-SA 3.0,
  strokes+components) + **kanji-data** (MIT, readings/meanings/levels), split per level and
  lazy-loaded. Stroke animation is our own `StrokeOrder` SVG component (not markdown).
- ✅ v2.5 **Stage B** shipped (kanji): per-kanji **AI mnemonic** — Claude builds a vivid, personalized
  memory story from the components + learner profile (`generateKanjiMnemonic` + `KANJI_MNEMONIC_INSTRUCTION`),
  cached per-user in the **`kanji`** table (migration **0007**) so revisiting is free; a **Mark learned**
  toggle; and **tappable kanji chips** on each vocab word in Library/Search (`KanjiChips`) that open the
  kanji card. Kanji actions (`kanji/actions.ts`) degrade gracefully if `0007` hasn't been run yet.
- ExercisePlayer holds a **local copy** of the exercises (so Check & fix can replace a question in
  place) and is **remounted via `key={playToken}`** by tests-client/lesson-practice when a new set
  loads — don't reintroduce a render-time prop→state sync (it trips `react-hooks`). `refineExercise`
  persists to whichever of `review_tests`/`lessons` the caller names by `index`. Deep-dive + chat→lesson
  degrade gracefully without their migrations (`0008`; chat reuses the existing text-lesson route with
  an optional `kind:"chat"`).
- SRS is **FSRS** via `ts-fsrs` (`src/lib/srs.ts`). It's **server-only** (imports ts-fsrs); client code
  imports only the `Rating`/`IntervalPreview` **types** (`import type`, erased). `schedule(row,rating)`
  returns the column bag written by `api/srs`; `previewIntervals(row)` (used by `review/page.tsx`) powers
  the per-button ETAs. `cardFromRow` seeds legacy SM-2 rows (stability ≈ old interval, difficulty 5). Don't
  reintroduce `srs_ease` logic — mastery/scopes now key on `srs_stability`/`srs_difficulty`.
- Deep-dive explanations are **prefetched server-side** (`library/explanations.ts` `loadExplanations`)
  and passed into `DeepDiveSection` as `initialExplanation`/`initialExamples` so cached ones render
  instantly (open by default) — don't rely only on the on-tap fetch. Rows with an explanation get a ✨
  badge (`explainedIds`). The nav tab strip scrolls on mobile but **wraps on `md+`** (`min-h-14`,
  `md:flex-wrap`) so all tabs are visible on desktop. The library has a "How are these levels decided?"
  `<details>` explaining the SRS-derived mastery levels (`src/lib/mastery.ts`).
- ✅ v2.6 shipped (exercise quality + chat→lesson + deep-dive): **★ arrange** hardened — the player
  now **swaps** tiles on drop (was evicting), and `normalizeExercise` forces the tiles to be exactly
  the four answer pieces (kills "excess options") + de-dupes MCQ choices; a per-question **Check & fix**
  button (`refineExercise` in `claude.ts` + `tests/actions.ts`) verifies/repairs a flagged exercise and
  **persists** it back into `review_tests.exercises` / `lessons.exercises`. Chat answers have a **Save
  as lesson** button (reuses `/api/lesson/text` with `kind:"chat"`). Saved vocab/grammar rows have an
  **Explain more** deep-dive (`generateDeepDive` + `knowledge_explanations` table, migration **0008**,
  `DeepDiveSection`) shown inline in Library + Search.
- ✅ v2.7 shipped (FSRS scheduler): spaced repetition moved from the hand-rolled SM-2 to **FSRS**
  (`ts-fsrs`, FSRS v6, target retention 0.9) — see `src/lib/srs.ts` (`schedule`/`previewIntervals`,
  legacy items seeded from their old interval on first review). New columns `srs_stability/
  srs_difficulty/srs_state/srs_last_review` (migration **0009**; `srs_ease` now legacy). Mastery
  labels derive from **stability** (`src/lib/mastery.ts`), the Tests "Struggling" scope uses
  `srs_difficulty>=7`, and flashcards now show the **predicted next interval under each rating
  button** (Again/Hard/Good/Easy).
- ⏳ Next ideas (not built): a standalone personalized-lesson generator; Anki export; paginate
  `/dashboard` and `/map` (still fetch all items — covered for now by `loading.tsx`); real
  brand icon to replace the placeholder seal in `src/lib/icon-art.tsx`; a true `lesson_id` link on
  `knowledge_items` (would replace the text-match in "Lessons mentioning this", future items only).

## Decisions log
- Hybrid AI (Gemini OCR/embeddings + Claude chat/lessons) for best quality-per-cost.
- Single-user auth kept (RLS needs a user); email confirmation off so it's effectively
  "log in once." No service-role key — RLS via the user session.
- Practice exercises use Claude structured outputs, generated BOTH automatically at lesson time
  (cached in `lessons.exercises`) and on demand (review tests from due items). Sonnet (`CHAT_MODEL`)
  for cost; review-test exercises carry `item_id`s so answers feed the SRS scheduler.
- "Mastery" coloring is derived purely from existing `srs_*` fields (`src/lib/mastery.ts`); no new
  data is stored. New helpers: `src/components/exercises/exercise-player.tsx`, `src/app/(app)/library/*`,
  chat drawer + windowing in `src/app/(app)/chat/*`.
- TTS uses the browser Web Speech API (ja-JP) — free, no API cost; `SpeakButton` no-ops where unsupported.
- Furigana in short fields (exercise options/tokens) renders via `RubyText` (`src/components/ruby-text.tsx`);
  `showReading()`/`stripFurigana()` in `src/lib/furigana.ts` hide redundant kana and normalize answer checks.
- PWA scope fix relies on `app/manifest.ts` (`scope:"/"`, `display:standalone`); the iOS home-screen app
  must be **removed and re-added** after deploy for a new manifest to take effect. App icons are generated
  at build with `ImageResponse` (no binary assets) — `LIBRARY_COLS` lives in `library/columns.ts` because a
  `"use server"` module may only export async functions. Calendar buckets by **UTC** day (matches dashboard);
  acceptable for a single user, revisit if local-tz day boundaries matter.
- Map Graph uses React Flow **uncontrolled** (`defaultNodes`/`defaultEdges` + `key={version}` to remount on
  Regenerate) so dragging works without `useNodesState`; positions are snapshotted in a ref on
  `onNodeDragStop` and saved into `knowledge_maps.data.positions` (jsonb, no migration). Node positions key
  on item id / `group-<id>`. Lesson-fetch + loading state run in the click handler (not an effect) to stay
  clear of the `react-hooks/set-state-in-effect` lint rule.
- Search (`/search`) matches client-side with `fuse.js` over `term/reading/romaji/meaning`, querying both
  the raw text and `wanakana.toHiragana(query)` so rōmaji/kana/kanji/English all hit; debounced server
  actions (driven from the input handler, not an effect) do the lesson `ilike`. Test "scopes" are pure SQL
  on `srs_*` (free); tokens are only spent in `POST /api/tests`; replays (`GET /api/tests/[id]`) are free.
  Generated tests persist in `review_tests`. `arrange` is JLPT ★-mode when the model emits a `{{BLANKS}}`
  marker + valid `star_index` + exactly four pieces; otherwise it falls back to the legacy whole-sentence
  arrange (old cached exercises keep working). Grading checks only the ★ slot.
- Kanji data is **bundled offline**: `npm run kanji:build` (`scripts/build-kanji-data.mjs`) downloads
  KanjiVG (per-glyph SVG via jsDelivr, cached in gitignored `scripts/.cache`) + kanji-data `kanji.json`,
  and emits `src/data/kanji/{levels,info/n*,strokes/n*}.json` grouped by JLPT (common-first). `src/lib/kanji.ts`
  eagerly loads the tiny `levels.json` for `levelOf`/lists and **lazy-loads** per-level info/strokes via
  dynamic `import()` (memoized). Components come from KanjiVG `kvg:element` group nesting (root's direct
  children); strokes are the ordered `<path d>`. Attribution (CC-BY-SA) is shown on the Kanji page.
