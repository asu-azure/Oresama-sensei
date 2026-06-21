-- 0018: per-user default model for the main chat tutor (the header dropdown).
-- One of 'gemini-flash' (cheap, default) / 'gemini-pro' / 'sonnet' / 'opus'.
-- The route also accepts a per-request override; this is just the remembered
-- default. Code degrades gracefully if this hasn't been run (treats as
-- 'gemini-flash'). OCR + lesson writing keep their own model pickers.

alter table public.profiles
  add column if not exists chat_model text not null default 'gemini-flash';
