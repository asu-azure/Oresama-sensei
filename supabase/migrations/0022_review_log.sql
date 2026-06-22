-- =============================================================================
-- JP Study — per-review history log (the "sawtooth"). Run after 0021 in the
-- Supabase SQL editor. One row per review event so we can reconstruct each
-- item's forgetting/recovery curve over time. The previous schema only kept the
-- CURRENT srs_* state on knowledge_items (each review overwrote it), so history
-- is forward-only: this fills in from the moment the table exists. RLS scopes
-- everything to the owner; /api/srs logs best-effort and degrades gracefully if
-- this hasn't been run yet.
-- =============================================================================

create table if not exists public.review_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  item_id          uuid not null references public.knowledge_items (id) on delete cascade,
  rating           text not null,        -- again | hard | good | easy
  reviewed_at      timestamptz not null default now(),
  elapsed_days     real,                 -- since previous review; null on first
  retrievability   real,                 -- 0..1 recall just BEFORE this review; null on first
  stability_before real,
  stability_after  real not null,
  difficulty_after real,
  state_after      smallint,             -- FSRS State: 0 New / 1 Learning / 2 Review / 3 Relearning
  interval_after   int                   -- scheduled days until next review
);

create index if not exists review_log_user_item_idx
  on public.review_log (user_id, item_id, reviewed_at);
create index if not exists review_log_user_time_idx
  on public.review_log (user_id, reviewed_at desc);

alter table public.review_log enable row level security;

create policy "own review log" on public.review_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
