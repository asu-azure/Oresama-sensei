-- 0016: clean up knowledge_items whose `term`/`reading` were stored with embedded
-- furigana markup (e.g. term = '<ruby>展覧会<rt>てんらんかい</rt></ruby>'). These fields
-- must be PLAIN text with the kana in `reading`, separately. This mirrors the
-- runtime stripFurigana()/readingFromRuby() logic now applied on write
-- (src/lib/memory.ts). `example` is left untouched — ruby is valid there.
-- Idempotent: re-running is a no-op once terms are plain.

-- 1) Backfill a missing reading from the <rt> contents of the term (handles
--    multiple rt groups by concatenating them in order).
update public.knowledge_items
set reading = (
  select string_agg(m[1], '')
  from regexp_matches(term, '<rt>(.*?)</rt>', 'g') as m
)
where term like '%<rt>%'
  and coalesce(reading, '') = '';

-- 2) Strip ruby markup from `term`: drop the <rt>…</rt> reading first, then the
--    <ruby>/<rp> tags, keeping the visible base text.
update public.knowledge_items
set term = regexp_replace(
             regexp_replace(term, '<rt>.*?</rt>', '', 'g'),
             '</?(ruby|rp)>', '', 'g')
where term like '%<ruby>%' or term like '%<rt>%';

-- 3) Same hygiene for any reading that itself carried ruby markup.
update public.knowledge_items
set reading = regexp_replace(
                regexp_replace(reading, '<rt>.*?</rt>', '', 'g'),
                '</?(ruby|rp)>', '', 'g')
where reading like '%<ruby>%' or reading like '%<rt>%';
