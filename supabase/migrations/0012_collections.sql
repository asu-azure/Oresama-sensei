-- =============================================================================
-- JP Study — source attribution + browsable "collections" (books / games /
-- series). Run after 0011 in the Supabase SQL editor.
--
--  * collections: a named container the learner can browse — a textbook, a game,
--    a manga series. Holds an optional cover image, page count, and a cached
--    AI-generated summary.
--  * lessons gain: where the material came from (material_type), an optional
--    link to a collection, and the page range it covers.
--  * knowledge_items gain: the same source attribution + a REAL lesson_id link
--    (replacing the old title/text ilike heuristic; populated for new items).
-- =============================================================================

create table if not exists public.collections (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  kind                 text not null default 'book'
                         check (kind in ('book', 'game', 'series', 'other')),
  title                text not null,
  author               text,
  cover_path           text,            -- storage path in the lesson-images bucket
  total_pages          int,
  summary_md           text,            -- AI-generated, cached (Phase 3)
  summary_generated_at timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists collections_user_idx
  on public.collections (user_id, created_at desc);

alter table public.collections enable row level security;

create policy "own collections" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lessons: source attribution + collection link + page range.
alter table public.lessons
  add column if not exists material_type text not null default 'textbook',
  add column if not exists collection_id uuid references public.collections (id) on delete set null,
  add column if not exists page_start int,
  add column if not exists page_end int;

create index if not exists lessons_collection_idx
  on public.lessons (collection_id);

-- Knowledge items: same attribution + the real lesson link.
alter table public.knowledge_items
  add column if not exists source_type text,
  add column if not exists collection_id uuid references public.collections (id) on delete set null,
  add column if not exists lesson_id uuid references public.lessons (id) on delete set null;

create index if not exists knowledge_collection_idx
  on public.knowledge_items (user_id, collection_id);
