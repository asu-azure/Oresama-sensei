-- =============================================================================
-- JP Study — move spaced repetition from SM-2 to FSRS. Run after 0008 in the
-- Supabase SQL editor. Adds the FSRS memory-model state to knowledge_items.
-- Existing srs_* columns are kept: srs_interval/srs_reps/srs_lapses/srs_due stay
-- in use, srs_ease becomes legacy/unused. Legacy items are seeded from their old
-- interval on their first FSRS review (handled in src/lib/srs.ts).
-- =============================================================================

alter table public.knowledge_items
  add column if not exists srs_stability    real,
  add column if not exists srs_difficulty   real,
  add column if not exists srs_state        smallint,   -- FSRS State: 0 New, 1 Learning, 2 Review, 3 Relearning
  add column if not exists srs_last_review  timestamptz;
