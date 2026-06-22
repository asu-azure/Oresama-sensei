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
1. Supabase project → run the SQL files in `supabase/migrations/` (0001–0021) in order in the SQL editor.
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
- Pitch accent: `src/lib/pitch.ts` is client-safe (`pitchPattern` pure; `lookupAccent` lazy-imports the
  4.4 MB `src/data/pitch/accents.json` only on first use). The toggle uses `useSyncExternalStore`
  (no effects → lint-clean). Accent = downstep mora (0 heiban). Show the **kanjium CC BY-SA 4.0** credit
  if surfacing attribution. `npm run pitch:build` regenerates the data (raw cached in `scripts/.cache`).
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
- ✅ v2.8 shipped (pitch accent): optional **pitch-accent marks** on vocab readings — a global
  **Pitch** toggle (`PitchToggle`/`use-pitch.ts`, localStorage, per-device) in Library/Search/Review;
  when on, readings render the classic **overline + downstep** notation (`PitchAccent` +
  `src/lib/pitch.ts` `splitMora`/`pitchPattern`). Data is the **kanjium** dictionary (CC BY-SA 4.0),
  built into `src/data/pitch/accents.json` by `scripts/build-pitch-data.mjs` (`npm run pitch:build`)
  and **lazy-loaded** only when pitch is enabled. Word-level only (sentence intonation isn't in free
  offline data). No DB change.
- ✅ v2.9 shipped (pitch colors + study coach): **(a)** pitch marks are now **colored by accent type**
  (平板/頭高/中高/尾高 → blue/rose/amber/emerald) with a small JP type tag + a `PitchLegend` shown by the
  toggle (`accentType`/`ACCENT_TYPE_META` in `src/lib/pitch.ts`). **(b)** a personalized **study coach**:
  `src/lib/insights.ts` derives strengths/weaknesses **live from FSRS state** (`computeInsights` reuses
  `masteryLevel`; zero LLM/DB cost — a struggling item self-resolves as it stabilizes). A **Study-next**
  widget + **Coach's note** sit on `/dashboard`; the chat tutor's system prompt now carries a compact
  `statsDigest` (`<learner_progress>` in `prompts.ts`) so Sensei adapts emphasis each turn. The coach
  note is the only paid call: `generateCoachNote` (**Haiku**, `COACH_MODEL`) via `/api/insights/coach`,
  **cached in `learner_insights`** (migration **0010**, owner runs it) keyed by a stats **signature** so
  it regenerates only when weaknesses shift or after 24h.
- ✅ v3.0 shipped (sources + books/collections + multi-page fix): **(a)** photo→lesson now **scales
  with page count** — `buildLessonSystemPrompt(profile, recalled, pageCount)` raises the word/vocab/grammar
  budget and tells the model to cover EVERY page (pages are wrapped in `<page n>` tags, not weak `--- Page ---`
  markers); `streamLesson(..., pageCount)` scales `max_tokens` (`base + 1800·(pages−1)`, cap 12k); recall
  is sampled across all pages (was page-1 only); **all** page images are saved (`lessons.image_paths`,
  migration **0011**); OCR default is now Gemini. Fixes the old "only the first page got attention" bug.
  **(b)** Every lesson/item carries a **source**: a material-type picker on upload (textbook/series/game/
  internet/real-world) + a **select-or-add collection** (book/game/series) with cover + page range
  (`src/lib/source.ts`, `src/lib/collections.ts`, migration **0012** adds `collections`, lessons
  `material_type/collection_id/page_start/page_end`, and items `source_type/collection_id/lesson_id` — the
  real `lesson_id` link finally replaces the title-ilike heuristic). `storeKnowledge` takes a
  `KnowledgeAttribution` (set on insert only; dedupe keeps the original source). Source badges + a source
  filter in Library; per-lesson **backfill** editor (`updateLessonSource` stamps items by `lesson_id`, or by
  term-in-text for legacy items). **(c)** New **Books** tab (`/books`, `/books/[id]`): collection cards,
  editable total pages, a **page grid colored by FSRS mastery** (`pageMastery()` in `lib/mastery.ts`;
  cover/index/skip flags via `collection_pages`, migration **0013**), tap-a-page → its lesson + items,
  per-collection vocab/grammar list, and a cached **AI summary** button (`generateCollectionSummary` +
  `buildCollectionSummaryPrompt`, cached in `collections.summary_md`). Run migrations **0011–0013** in order.
- ✅ v3.1 shipped (study-page AI helper, cost toggle, UX polish): **(a)** the in-test discuss drawer
  became a **floating "Ask Sensei" bubble** (`src/components/ask-sensei/ask-sensei.tsx`) reused on
  **tests, lessons, flashcards, and kanji** — context-aware via a discriminated `AskContext` union
  (`exercise|vocab|kanji|lesson|free`) that `buildDiscussSystemPrompt(context)` branches on; on mobile
  it's a bottom **sheet** so the close X is never trapped under the top nav (the old bug). Hosts lift
  the active item: `ExercisePlayer` reports `onIndexChange`; the old `ExerciseDiscussPanel`/in-player
  "Ask AI" button are gone (file now unused). **(b)** Lessons get a **Quick (Gemini) / Standard
  (Claude Sonnet) / Deep (Opus)** writer toggle (`lessonModel` form field → `runClaudeLessonStream` /
  `runGeminiLessonStream`); **deep no longer silently uses Opus** — only when picked. `generateExercises`
  `max_tokens` trimmed. **(c)** Library mastery legend + source filter now count the **whole DB**
  (`page.tsx` aggregates SRS fields for all items via `masteryLevel`), not just the loaded 150.
  **(d)** Books page grid collapses into **ranges of 50** with a mini mastery bar + "N studied" and a
  **jump-to-page** box (`book-detail.tsx`). **(e)** Kanji: detail remembers the level you came from via
  `?level=`/`?from=` + sessionStorage **scroll restore**; **learned (top-right) and has-words
  (bottom-right) badges no longer overlap**; the **mnemonic generator is structured** (`KANJI_MNEMONIC_SCHEMA`
  → `{mnemonic, examples}`) with a **Gemini/Claude model picker**, and its 2–3 example words are
  **auto-saved to the library** tagged `source_type:"kanji"` (new SourceType + badge) and cached in
  `kanji.examples` (migration **0014**, degrades gracefully). **(f)** After a flashcard session you get
  **"Keep studying (N due)"** (review page returns a total due count); the test/lesson completion screen
  supports an `onContinue`. **(g)** Check & fix takes a **free-text note** (`refineExercise(ex, note)` →
  `<learner_note>`); exercise prompts tightened against **answer-giveaway MCQs** and **duplicate arrange
  tiles** (`normalizeExercise` rejects a ★-tile already present in the visible sentence). **(h)** Lesson
  prompt now adds a **問題の解説** section that solves/explains any exercises present in the photo.
  **(i)** Dashboard "Added in 14 days" → **Activity** (added + reviewed, with a min bar height and an
  empty-state link to Review). **(j)** Every action that spends API tokens now shows a tiny
  **`CostHint`** (`src/components/cost-hint.tsx`) — a coin icon + the model name (e.g. "Claude Sonnet",
  "Gemini Flash", "Claude Haiku") with a hover tooltip — on chat send, lesson/summary/exercise/test/map/
  coach/deep-dive/collection generation, Check & fix, Ask Sensei, and kanji mnemonics. Run migration
  **0014** after 0011–0013. *(Search/Library scroll-position memory was intentionally left out —
  restoring it needs setState-in-effect, which the lint forbids.)*
- ✅ v3.2 shipped (Gemini-default engine, lesson model options, mobile & ruby fixes): **(a)** a global
  **AI engine** setting (`profiles.ai_engine`, migration **0015**, Settings toggle, default **gemini**)
  routes the *secondary* AI calls to Gemini, switchable to Claude. Mixed tiers via `AiEngine` +
  `resolveEngine` (`src/lib/claude.ts`) and `getAiEngine` (`src/lib/ai-engine.ts`): structured/cheap →
  **Gemini Flash** (`generateExercises`, `refineExercise`, `extractKnowledge`, `generateKnowledgeMap`,
  `generateDeepDive`, `generateCoachNote`), conversational → **Gemini Pro** (`runDiscussStream`,
  `runSummaryStream`, `generateCollectionSummary`). Each generator takes an `engine` param and branches
  to shared Gemini helpers (`geminiStructured`/`geminiText`/`runGeminiStream` in `src/lib/gemini.ts`,
  reusing each function's existing parser). **The main chat tutor (`streamChat`) and OCR always stay on
  their own models** — chat = Claude. Routes/actions read `ai_engine` and thread it (discuss + summary
  routes refactored to the `onDelta` ReadableStream shape). `CostHint` on these shows **"AI engine"**
  (model follows the toggle). **(b)** Lesson uploads gain a **Quick+ (Gemini Pro)** option (4th choice;
  `gemini-pro` was already wired). **(c)** Lessons now **force English** output (explicit directive in
  `buildLessonSystemPrompt` + reinforced in `runGeminiLessonStream`) — fixes Flash writing lessons in
  Japanese. **(d)** **Ruby fix**: Gemini JSON HTML-escapes `<ruby>` (→ literal `&lt;ruby&gt;`);
  `decodeRubyEntities` (safe `&lt;`/`&gt;`/`&amp;`, never `&quot;`) runs on all Gemini JSON, plus
  `cleanRuby` strips stray backticks around ruby in `parseKanjiMnemonic`. **(e)** **iOS keyboard zoom**:
  `@media (pointer: coarse) { input,textarea,select { font-size:16px } }` in `globals.css` (touch only;
  no `maximum-scale`, pinch-zoom preserved). Run migration **0015** after 0011–0014.
- ✅ v3.3 shipped (Ask-Sensei fixes + selectable chat model + SNS helper): **(a)** **Ask Sensei**
  bottom-sheet now **lifts above the on-screen keyboard** (`useKeyboardInset` via `visualViewport`,
  `useSyncExternalStore` so it's lint-clean) — fixes the iOS bug where the input was hidden behind the
  keyboard and only the suggestion chips were tappable; the discuss prompt switched from `<ruby>` HTML
  to **parenthetical furigana** 漢字（かんじ） (Gemini was HTML-escaping the tags) with a client-side
  `decodeRubyEntities` (now in `src/lib/furigana.ts`) as defense; and **Save to notes** now stores a
  cheap **1-line AI summary** (`summarizeNote` in `claude.ts` → `appendNoteSummary` in
  `review/actions.ts`) instead of the whole reply. **(b)** Flashcard reveal shows a **tappable kanji
  breakdown** (char + primary meaning, linking to `/kanji/[char]`) — computed server-side in
  `review/page.tsx` (`kanjiGlosses` via `@/lib/kanji` `getInfo`; `buildMeta` is now async, stored in
  `CardMeta.kanji`); resume-after-navigation already works via `use-review-session.ts`. **(c)** The
  **main chat tutor is now model-selectable** — a header dropdown (Gemini Flash default / Pro / Sonnet /
  Opus) persisted in `profiles.chat_model` (**migration 0018**). `streamChat` was replaced by
  `runChatStream({model,onDelta})` in `claude.ts` (`ChatModel`/`resolveChatModel`; Claude via Anthropic
  stream, Gemini via `runGeminiStream`); `/api/chat` takes a `model` body field (falls back to the saved
  default), `chat-client` sends it + persists via `setChatModel` and the `CostHint` follows the choice.
  OCR + lesson writing keep their own pickers. **(d)** New **SNS** tab (`/sns`) — a natural X/Twitter
  communication helper: pick a **mode** (Reply / New post / Explain) + **tone**, give light context
  (their message / what you want to say in Thai or rough JP), and get **3 natural Japanese phrasings**
  each with a **Thai translation + nuance note** (+ a short ちょい学び kanji/grammar aside), or a Thai
  **explanation** of a pasted tweet. `buildSnsSystemPrompt`/`buildSnsUserMessage` in `prompts.ts` adapt
  the owner's Thai gem prompt (male, casual SNS-savvy, respects the user's word choices, N2 woven in but
  **not capped — N1+ too**); explanations stay in **Thai** via a new `geminiStructured({english:false})`
  flag. `generateSnsOptions` (structured, Gemini Pro / Claude) in `claude.ts`; `/api/sns` saves history
  (`sns_interactions`, **migration 0019**) and **auto-extracts** vocab/grammar into the library
  (`source_type:"sns"`, all levels). A refine chat reuses the **Ask Sensei** bubble via a new
  `AskContext` `kind:"sns"`. Run migrations **0018**+**0019** after 0015.
- ✅ v3.4 shipped (mobile UI/UX polish): **(a)** **Pitch-accent alignment** — marked morae no longer sit
  ~3px lower; every mora now reserves a uniform transparent `border-t-[3px]` and only the overline
  (top)/downstep (right) get color via new per-side classes (`over`/`drop`) in `ACCENT_TYPE_META`
  (`pitch.ts`) — see `pitch-accent.tsx`. **(b)** **Dashboard 14-day chart** no longer overflows on
  mobile: per-day columns got `min-w-0`, labels `truncate`, bars row `overflow-hidden`
  (`dashboard/page.tsx`). **(c)** **Safe-area / Dynamic Island** — `appleWebApp.statusBarStyle` is now
  **`black-translucent`** so the installed PWA paints edge-to-edge under the island (header keeps its
  `env(safe-area-inset-top)` padding; mobile header bg made opaque). NOTE: Dynamic Island **Live
  Activities are native-iOS-only (ActivityKit) — a PWA cannot use them**; re-add the home-screen app
  after deploy for the status-bar change. **(d)** **Flashcard "hologram glitch"** transition — RGB-split
  `glitch-in` CSS keyframe (`globals.css`) on reveal + card advance in `review-client.tsx`, gated by
  `useReducedMotion()` (plain fade when reduced). **(e)** **Tap sounds + haptics** (default ON) — tiny
  synthesized Web Audio blips + `navigator.vibrate`, no asset files (`src/lib/use-sound.ts`,
  `useSyncExternalStore` flag like `use-pitch`); hooked into the shared **Button**, flashcard
  reveal/grade, and nav taps; **SoundToggle** in Settings ("Device preferences"). **(f)** **Tap-registered
  feedback** — each nav link shows a pending spinner via Next 16 **`useLinkStatus`** (`NavLinkSpinner`
  in `nav.tsx`), and new **`loading.tsx`** skeletons added for `review/chat/books/lessons/settings/sns`
  (reuse `GeometricLoader`). No DB migration. Settings AI-engine help text updated (chat now has its own
  model picker).
- ✅ v3.5 shipped (pitch render rewrite + modern sound): **(a)** `PitchAccent` (`pitch-accent.tsx`)
  no longer draws the overline with per-mora transparent borders (low morae were falling back to a
  visible border → "line over everything"); it now renders **explicit** `.pitch-line`/`.pitch-drop`
  elements **only on high/drop morae**, so atamadaka shows the overline on mora 1 only. The line
  **draws left→right** (`pitch-draw` keyframe, staggered `--pitch-delay`) with a soft fuse-like glow
  (`pitch-glow`) colored by accent type via a new `cssColor` (`var(--color-*)`) field in
  `ACCENT_TYPE_META`; reduced-motion shows a static line. Keyframes/classes in `globals.css`.
  **(b)** UI sound (`src/lib/use-sound.ts`) swapped from chiptune oscillator sweeps to **soft sine
  ticks** through a low-pass filter with a smooth envelope (tap/reveal/grade); on/off + haptics unchanged.
- ✅ v3.6 shipped (SNS reliability + feedback loop, futuristic splash, chat UX): **(a)** **SNS helper
  reliability** — `generateSnsOptions` (`claude.ts`) no longer silently returns empty on a bad model
  response: it now runs a **fast primary** (Gemini **Flash**, or Claude Sonnet when engine=claude) and,
  if that comes back with zero options/explanation, **retries once on the other engine's stronger tier**
  (Gemini **Pro** / Claude Sonnet); parse failures are now `console.error`'d (was a silent `catch`). The
  502 "try rephrasing" only fires when **both** attempts fail. Refactored into `runSnsAttempt` +
  `parseSnsResult` + `isEmptySns`. **(b)** **"Edit & check" teacher feedback** — each SNS option now has
  an inline editor (`sns-client.tsx`, pre-filled with the option's furigana-stripped Japanese); submitting
  calls **`POST /api/sns/review`** → `reviewSnsDraft` (`claude.ts`, same fast+fallback pattern,
  `SNS_REVIEW_SCHEMA`/`buildSnsReviewSystemPrompt` in `prompts.ts`) which returns a corrected version,
  1–5 naturalness rating, an encouraging note, and **tagged errors** (`{type,wrong,right,note}`). Each
  check is logged to a **learner error corpus** — new table **`sns_corrections`** (migration **0020**,
  best-effort insert, degrades if unrun). New types `SnsReview`/`SnsError`/`SnsCorrection` in `types.ts`.
  **(c)** **"Save chat as lesson" is now model-selectable** — `saveAsLesson` (`chat-client.tsx`) gained a
  small dropdown (Quick Gemini Flash / Quick+ Gemini Pro / Standard Sonnet / Deep Opus) sent as
  `lessonModel`; was hard-locked to Sonnet. `/api/lesson/text` already accepted the field. **(d)** **Chat
  starter questions fill the input** instead of auto-sending (`fillSuggestion` strips the trailing "(hint)"
  + focuses the textarea) — saves a wasted API call so you can attach your words first. **(e)** **Splash
  redesign (superseded by v3.7).** **(f)** **Merge fix:** removed a duplicate `inputRef` declaration in
  `chat-client.tsx` (a clean-but-wrong 3-way autostash merge had added it twice). Run migration **0020**
  after 0016–0019.
- ✅ v3.7 shipped (splash redesign — stroke draw + RGB glitch): `splash-screen.tsx` rewritten to feel like
  the **flashcard reveal**. Each title kanji 俺様先生 **draws its strokes one-by-one** (KanjiVG paths via the
  `stroke-dashoffset` technique from `stroke-order.tsx`, scaled to a fixed ~0.46s per-char window), a
  **box sweep** wipes the slot (new `.splash-sweep` in `globals.css`), then the crisp glyph **RGB-glitches**
  in (reuses the flashcard `glitch-in` keyframe) as the stroke layer fades; finish with a rainbow+green
  underline. **Theme-aware** (uses `--background`/`--primary`/`--foreground`/`--pop-*` tokens — green/white
  in light, dark/neon-green in dark; rainbow accents in both) and **reduced-motion safe** (just a quick
  glyph fade). Stroke paths are **hardcoded** in new `src/lib/splash-art.ts` (`SPLASH_STROKES`) so the
  splash never loads the large per-level kanji bundles; `俺` is outside the JLPT set so it was fetched once
  from the KanjiVG CDN (`04ffb.svg`) and inlined. The v3.6 navy `splash-grid` keyframe was removed. No DB
  change.
- ✅ v3.8 shipped (Ask-Sensei UX + splash simplify): **(a)** **Close button always reachable** — the
  Ask-Sensei panel (`ask-sensei.tsx`) no longer lifts the whole sheet with `translateY(-kbInset)` (which
  shoved the header X up behind the top bar on a long reply). It now raises the sheet's **bottom** by the
  keyboard overlap (`--kb` custom prop) and **shrinks max-height** by `--kb` + `--top-nav`, so the panel
  top is pinned just below the top nav regardless of keyboard/content. **(b)** **Bigger input** — textarea
  auto-grow cap 112→176px (`max-h-44`) and desktop panel 400→**440px** so multi-line drafts are readable.
  **(c)** **Draggable bubble** — the floating Ask-Sensei button is now `drag`-gable (Framer, bounded to a
  `constraintsRef` viewport box, `touch-none`); a `draggingRef` guard stops a drag from also opening the
  panel. Resets per page mount (no persistence). **(d)** **Splash simplified** — per the owner the strokes
  felt mismatched with the bold final glyphs; `splash-screen.tsx` now glitches the **whole title in at
  once** (reuses `glitch-in` + `.splash-sweep` + glow + underline, theme-aware, reduced-motion safe). The
  stroke-draw + `src/lib/splash-art.ts` (`SPLASH_STROKES`) were removed. No DB change.
- ✅ v3.9 shipped (images on knowledge items): a vocab/grammar item can carry **one picture** (a visual
  memory aid) shown on the **flashcard reveal** and in the **library/search** rows, added three ways:
  **Upload** from device, **Draw** a doodle (`draw-canvas.tsx`, HTML5 canvas → PNG), or **Find online**
  (`web-image-search.tsx` → Openverse, free CC-licensed, via proxy `GET /api/items/image-search`; **uses
  no AI tokens**). "Find online" shows **keyword chips** (English meaning default + Japanese term/reading,
  built locally from the item — no AI) plus an editable box for a custom keyword. The
  shared control is `src/components/knowledge/item-image.tsx` (current image via `ImagePreview` lightbox +
  an Upload/Draw/Find/Remove menu), used by `review-client` (on reveal), `library-client`, and
  `search-client`. Bytes go to the existing private **`lesson-images`** bucket under `<uid>/items/...`;
  server actions in **`src/lib/item-image-actions.ts`** (`uploadItemImage`/`setItemImageFromUrl`/
  `removeItemImage`/`getItemImageUrls`) handle upload/download/sign/remove (web picks are **downloaded
  into storage** so they persist privately, with a stored attribution `image_source`). Migration **0021**
  adds `knowledge_items.image_path` + `image_source` (degrades gracefully). Review signs urls server-side
  in `buildMeta`; library/search sign **lazily** when a row expands (`getItemImageUrls`). Known limit:
  deleting an item doesn't delete its storage object (orphan; fine for one user). Run migration **0021**.
- ⏳ Next ideas (not built): an **SNS growth view** that aggregates `sns_corrections.errors[].type` over
  time (the error log is being collected now); library multi-select bulk source-tag (per-lesson editor covers backfill for
  now); per-page knowledge granularity (page color currently aggregates the whole lesson's items); a
  standalone personalized-lesson generator; Anki export; paginate
  `/dashboard` and `/map` (still fetch all items — covered for now by `loading.tsx`); real
  brand icon to replace the placeholder seal in `src/lib/icon-art.tsx`; a true `lesson_id` link on
  `knowledge_items` (would replace the text-match in "Lessons mentioning this", future items only).
- ⏳ Maintenance / `npm audit`: 2 moderate advisories (GHSA-qx2v-qp2m-jg93, `postcss < 8.5.10` XSS)
  come **only** from the `postcss@8.4.31` bundled inside `next@16.2.9` (our own postcss via
  `@tailwindcss/postcss` is 8.5.15, already patched). Not exploitable here — Next's postcss processes
  our own build-time CSS, not user input. **Do NOT run `npm audit fix --force`** (it would downgrade
  next 16→9). The real fix lands in **Next 16.3.0** (only `16.3.0-preview.*` exists as of 2026-06-18,
  we're on the latest stable). Bump to `next@16.3.0` when it ships stable and the advisories clear.

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
- Learner strengths/weaknesses are **derived live** from the FSRS `srs_*` columns (`src/lib/insights.ts`),
  NOT stored in a separate maintained table — the SRS state already IS a self-updating capability model,
  so a derived view can't drift and costs nothing. The only persisted thing is the AI **coach narrative**
  (`learner_insights`), cached by a weakness **signature** + 24h TTL so the Haiku call rarely fires.
  Chat awareness is the same digest injected into the prompt (no per-message LLM analysis).
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
