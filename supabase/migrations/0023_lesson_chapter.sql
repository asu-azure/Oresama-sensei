-- =============================================================================
-- JP Study — "chapter" organizing layer for lessons. Run after 0022 in the
-- Supabase SQL editor. Adds a free-text chapter name (e.g. "Arc 2: The
-- Tournament" — not necessarily numeric) plus an OPTIONAL in-chapter page number
-- that is independent of the book-level page_start/page_end. The book detail view
-- groups a collection's lessons into collapsible chapter sections. Both columns
-- are nullable so existing lessons and uploads keep working untouched; app code
-- reads/writes them best-effort and degrades gracefully if this isn't run.
-- =============================================================================

alter table public.lessons
  add column if not exists chapter text,
  add column if not exists chapter_page int;
