-- =============================================================================
-- JP Study — saved practice tests ("test bank"). Run after 0005 in the Supabase
-- SQL editor. Generated tests are stored here so the user can replay them for
-- free (no token cost) and pick a focus scope. Each row's `exercises` is the
-- same Exercise[] shape the ExercisePlayer renders; `scope`/`meta` describe how
-- it was generated.
-- =============================================================================

create table if not exists public.review_tests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  scope        text not null,            -- 'struggling' | 'new' | 'due' | 'filter'
  meta         jsonb,                    -- { level?, type?, item_count }
  exercises    jsonb not null,           -- Exercise[]
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  used_count   int not null default 0
);

create index if not exists review_tests_user_idx
  on public.review_tests (user_id, created_at desc);

alter table public.review_tests enable row level security;

create policy "own review tests" on public.review_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
