-- =============================================================================
-- JP Study — SNS learner error log. Run after 0019 in the Supabase SQL editor.
-- One row per "Edit & check": the learner's own draft, the teacher's corrected
-- version, and the tagged mistakes. This is a small learner error corpus — a
-- future "growth" view can aggregate errors[].type over time. RLS scopes
-- everything to the owner. The page degrades gracefully if this hasn't run.
-- =============================================================================

create table if not exists public.sns_corrections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  draft       text not null,          -- the learner's own version
  corrected   text not null,          -- the teacher's fixed version
  original    text,                   -- the AI suggestion they started from (optional)
  rating      int,                    -- 1-5 naturalness of the draft
  errors      jsonb not null default '[]',  -- [{type, wrong, right, note}]
  feedback    text,
  created_at  timestamptz not null default now()
);

create index if not exists sns_corrections_user_created_idx
  on public.sns_corrections (user_id, created_at desc);

alter table public.sns_corrections enable row level security;

create policy "own sns corrections" on public.sns_corrections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
