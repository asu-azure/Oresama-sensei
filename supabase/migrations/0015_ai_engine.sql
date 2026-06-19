-- 0015: per-user default AI engine for secondary (non-chat, non-lesson) calls.
-- 'gemini' (cheaper, default) routes exercises/mnemonics/deep-dives/map/summary/
-- coach/Ask-Sensei to Gemini (Flash for structured, Pro for conversational);
-- 'claude' routes them all to Claude Sonnet. The chat tutor and OCR are
-- unaffected. Code degrades gracefully if this hasn't been run (treats as gemini).

alter table public.profiles
  add column if not exists ai_engine text not null default 'gemini';
