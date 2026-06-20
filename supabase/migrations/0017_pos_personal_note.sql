-- 0017: part-of-speech + a personal (user-written) note on knowledge items.
--
-- part_of_speech: a coarse grammatical class set during extraction, used to
--   render an automatic conjugation table on flashcards (verbs/adjectives).
--   Values are a small controlled vocabulary, e.g. 'godan verb', 'ichidan verb',
--   'suru verb', 'kuru verb', 'i-adjective', 'na-adjective', 'noun', 'adverb',
--   'expression'. Empty/unknown is fine — the UI just hides the table.
-- personal_note: the learner's OWN note (distinct from the AI-generated `notes`
--   nuance field). Editable on the flashcard; chat replies can be appended here.
--
-- Code degrades gracefully if this hasn't run yet (mirrors 0007/0014).

alter table public.knowledge_items
  add column if not exists part_of_speech text;

alter table public.knowledge_items
  add column if not exists personal_note text;
