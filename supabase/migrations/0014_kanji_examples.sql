-- 0014: cache the AI-generated example words for a kanji mnemonic.
-- The mnemonic generator now also produces 2–3 example words (with readings,
-- meanings and a sentence) that are saved to knowledge_items AND cached here so
-- revisiting a kanji is free. Code degrades gracefully if this hasn't run yet.

alter table public.kanji
  add column if not exists examples jsonb;

-- (examples is a small JSON array like
--  [{"term":"行動","reading":"こうどう","meaning":"action","example":"…"}])
