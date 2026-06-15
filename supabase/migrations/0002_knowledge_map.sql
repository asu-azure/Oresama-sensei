-- =============================================================================
-- JP Study — knowledge map cache (run after 0001 in the Supabase SQL editor)
-- Stores the latest AI-generated grouping/relationship map of a user's
-- knowledge_items so the /map page doesn't regenerate (and re-spend tokens) on
-- every visit. A "Regenerate" button inserts a fresh row; newest wins.
-- =============================================================================

create table if not exists public.knowledge_maps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  item_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_maps_user_idx
  on public.knowledge_maps (user_id, created_at desc);

alter table public.knowledge_maps enable row level security;

create policy "own knowledge maps" on public.knowledge_maps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
