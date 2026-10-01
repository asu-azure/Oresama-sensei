# 俺様先生 (oresama-sensei)

A private, single-user Japanese study app: FSRS flashcards with a daily budget, a searchable word
list with quick-add, and the JLPT kanji with stroke order and personal mnemonics.

Astro + Svelte 5 islands + Supabase (in the browser, under RLS) + Gemini, on Vercel.
See [`CLAUDE.md`](./CLAUDE.md) for the full brief.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL/key and GEMINI_API_KEY
npm run dev                  # http://localhost:4321
npm run check && npm test && npm run build
```

The Next.js version this replaced is tagged `nextjs-v4.4`.
