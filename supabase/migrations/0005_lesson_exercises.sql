-- Cache generated practice exercises (jsonb array of Exercise) on each lesson.
alter table public.lessons
  add column if not exists exercises jsonb;