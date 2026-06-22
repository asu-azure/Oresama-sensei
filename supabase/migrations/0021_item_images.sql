-- =============================================================================
-- JP Study — optional image per knowledge item (a visual memory aid shown on the
-- flashcard reveal + in the library/search). The image bytes live in the existing
-- private `lesson-images` storage bucket under <uid>/items/...; these columns just
-- hold the path + (for web picks) an attribution credit. Run after 0020.
-- Degrades gracefully if not run (the UI hides the image control).
-- =============================================================================

alter table public.knowledge_items
  add column if not exists image_path text;

alter table public.knowledge_items
  add column if not exists image_source text;  -- creator · license · landing URL (web images only)
