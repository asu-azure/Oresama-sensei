-- =============================================================================
-- JP Study — SNS communication assistant history. Run after 0018 in the
-- Supabase SQL editor. One row per generated request: the lightweight context
-- the learner gave (inputs), the phrasing options produced, and an optional
-- explanation (for "explain" mode). RLS scopes everything to the owner.
-- The page degrades gracefully if this hasn't been run yet.
-- =============================================================================

create table if not exists public.sns_interactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  mode        text not null,          -- 'reply' | 'compose' | 'explain'
  inputs      jsonb not null,         -- { mode, register, posted, incoming, intent, extra }
  options     jsonb not null,         -- [{ japanese, thai, register, nuance }]
  note        jsonb,                  -- { kanji, grammar } | null
  explanation text,                   -- filled for 'explain' mode
  created_at  timestamptz not null default now()
);

create index if not exists sns_interactions_user_created_idx
  on public.sns_interactions (user_id, created_at desc);

alter table public.sns_interactions enable row level security;

create policy "own sns interactions" on public.sns_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
