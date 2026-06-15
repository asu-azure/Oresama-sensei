-- =============================================================================
-- JP Study — spaced-repetition fields + lesson kind (run after 0002)
-- =============================================================================

-- Spaced-repetition scheduling on each knowledge item (SM-2 style).
alter table public.knowledge_items
  add column if not exists srs_due      timestamptz,
  add column if not exists srs_interval int  not null default 0,   -- days
  add column if not exists srs_ease     real not null default 2.5,
  add column if not exists srs_reps     int  not null default 0,
  add column if not exists srs_lapses   int  not null default 0;

create index if not exists knowledge_items_due_idx
  on public.knowledge_items (user_id, srs_due);

-- Distinguish photographed lessons from generated "summary of everything" reviews.
alter table public.lessons
  add column if not exists kind text not null default 'photo';

-- RLS already covers both tables from 0001 (policies apply to new columns).
