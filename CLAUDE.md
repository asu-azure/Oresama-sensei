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
1. Supabase project → run the SQL files in `supabase/migrations/` (0001–0005) in order in the SQL editor.
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
- ⏳ Next ideas (not built): a standalone personalized-lesson generator; Anki export.

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
