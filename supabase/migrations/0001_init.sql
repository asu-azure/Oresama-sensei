-- =============================================================================
-- JP Study — initial schema (run in Supabase SQL editor or via CLI)
-- Single-user personal app; every row is scoped to auth.uid() via RLS.
-- =============================================================================

create extension if not exists vector;

-- Embedding dimensionality must match EMBED_DIM in src/lib/gemini.ts (768).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  interests       text,
  jlpt_target     text not null default 'N2',
  native_language text not null default 'Thai',
  tone            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  embedding       vector(768),
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- knowledge_items — the accumulating vocab / grammar / expression base
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('vocab', 'grammar', 'expression')),
  term        text not null,
  reading     text,
  meaning     text,
  example     text,
  jlpt_level  text,
  notes       text,
  source      text,
  times_seen  int  not null default 1,
  last_seen   timestamptz not null default now(),
  embedding   vector(768),
  created_at  timestamptz not null default now()
);
create index if not exists knowledge_user_type_idx
  on public.knowledge_items (user_id, type);
create index if not exists knowledge_embedding_idx
  on public.knowledge_items using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- lessons — generated from photographed pages
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  image_path  text,
  source_text text,
  article_md  text,
  tags        text[],
  created_at  timestamptz not null default now()
);
create index if not exists lessons_user_idx on public.lessons (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.lessons         enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own knowledge" on public.knowledge_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own lessons" on public.lessons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Vector search RPC (RLS applies — runs as the calling user)
-- ---------------------------------------------------------------------------
create or replace function public.match_knowledge (
  query_embedding vector(768),
  match_count int default 8,
  p_type text default null
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  term text,
  reading text,
  meaning text,
  example text,
  jlpt_level text,
  notes text,
  source text,
  times_seen int,
  last_seen timestamptz,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    k.id, k.user_id, k.type, k.term, k.reading, k.meaning, k.example,
    k.jlpt_level, k.notes, k.source, k.times_seen, k.last_seen, k.created_at,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.knowledge_items k
  where k.user_id = auth.uid()
    and k.embedding is not null
    and (p_type is null or k.type = p_type)
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: private bucket for lesson images, scoped to <uid>/... paths
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('lesson-images', 'lesson-images', false)
on conflict (id) do nothing;

create policy "own lesson images read" on storage.objects
  for select using (
    bucket_id = 'lesson-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own lesson images insert" on storage.objects
  for insert with check (
    bucket_id = 'lesson-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own lesson images delete" on storage.objects
  for delete using (
    bucket_id = 'lesson-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
