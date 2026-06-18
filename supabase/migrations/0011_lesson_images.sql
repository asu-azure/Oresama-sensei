-- =============================================================================
-- JP Study — keep ALL uploaded page images for a lesson, not just the first.
-- Run after 0010 in the Supabase SQL editor. `image_path` stays as the first
-- image (back-compat); `image_paths` holds every page image in upload order.
-- =============================================================================

alter table public.lessons
  add column if not exists image_paths text[];
