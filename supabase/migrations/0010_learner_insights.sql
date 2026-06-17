-- =============================================================================
-- JP Study — cached AI "coach note." Run after 0009 in the Supabase SQL editor.
-- One row per user: a short natural-language coaching summary + named focus areas
-- generated from the learner's live strengths/weaknesses. Cached and regenerated
-- only when the weakness picture materially shifts (stats_signature changes) or
-- it goes stale (>24h), so it costs at most one cheap LLM call per day.
-- =============================================================================

create table if not exists public.learner_insights (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  summary_md      text not null,
  focus_areas     jsonb,            -- [{ label, why, action }]
  stats_signature text not null,    -- hash of the weakness picture this was built for
  generated_at    timestamptz not null default now()
);

alter table public.learner_insights enable row level security;

create policy "own insights" on public.learner_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
