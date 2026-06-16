-- =============================================================================
-- JP Study — per-kanji study state. Run after 0006 in the Supabase SQL editor.
-- Stores the learner's AI-generated mnemonic (personalized, cached so revisiting
-- is free) and a "learned" flag, one row per (user, character). The kanji
-- readings/strokes/components themselves are bundled offline in src/data/kanji.
-- =============================================================================

create table if not exists public.kanji (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  character   text not null,
  mnemonic    text,
  learned     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, character)
);

create index if not exists kanji_user_idx on public.kanji (user_id);

alter table public.kanji enable row level security;

create policy "own kanji" on public.kanji
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
