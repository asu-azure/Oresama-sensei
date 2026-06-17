-- =============================================================================
-- JP Study — cached on-demand "deep dive" explanations for saved knowledge
-- items. Run after 0007 in the Supabase SQL editor. One row per (user, item):
-- a richer AI explanation (nuance/register/pitfalls) + extra example sentences,
-- generated when the user taps "Explain more" and cached so revisiting is free.
-- =============================================================================

create table if not exists public.knowledge_explanations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items (id) on delete cascade,
  explanation_md    text not null,
  examples          jsonb,          -- [{ ja, en }]
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, knowledge_item_id)
);

create index if not exists knowledge_explanations_idx
  on public.knowledge_explanations (user_id, knowledge_item_id);

alter table public.knowledge_explanations enable row level security;

create policy "own explanations" on public.knowledge_explanations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
