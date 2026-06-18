-- =============================================================================
-- JP Study — per-page tracking for a collection (book/game/series). Run after
-- 0012 in the Supabase SQL editor.
--
-- One row per (collection, page_number). A page can be:
--   * 'content' — a real study page (usually linked to the lesson it produced),
--   * 'cover' / 'index' — not study material (shown but not colored by mastery),
--   * 'skip' — intentionally skipped.
-- The books page grid renders pages 1..total_pages, coloring each by the FSRS
-- mastery of the knowledge from its lesson.
-- =============================================================================

create table if not exists public.collection_pages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  page_number   int not null,
  status        text not null default 'content'
                  check (status in ('content', 'cover', 'index', 'skip')),
  lesson_id     uuid references public.lessons (id) on delete set null,
  image_path    text,
  created_at    timestamptz not null default now(),
  unique (user_id, collection_id, page_number)
);

create index if not exists collection_pages_idx
  on public.collection_pages (user_id, collection_id, page_number);

alter table public.collection_pages enable row level security;

create policy "own collection pages" on public.collection_pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
