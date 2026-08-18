-- =============================================================================
-- JP Study — daily study budget + parked ("suspended") items. Run after 0023 in
-- the Supabase SQL editor. Two changes:
--   1. profiles gains the learner's study pace: how many NEW cards and how many
--      REVIEWS to serve per day, plus the timezone + hour at which a "study day"
--      rolls over (default 4am Asia/Bangkok, so a session running past midnight
--      still counts as the same day). The review queue budgets against these and
--      the app now shows TODAY'S remaining work instead of the lifetime pile.
--      This matters because knowledge_items are created with srs_due = NULL,
--      which the queue treats as due — so every word extracted from a chat or a
--      photographed page used to inflate the "due" count the moment it appeared.
--   2. knowledge_items gains srs_suspended — auto-extracted junk can be parked
--      for good: it leaves the review queue, the new queue, the due counts and
--      the test scopes, but stays visible (and un-parkable) in the library.
-- Defaults match the app's fallbacks, so the code degrades gracefully if this
-- hasn't been run yet (budgets fall back to 15/80, the Park control is hidden).
-- =============================================================================

alter table public.profiles
  add column if not exists daily_new_limit    int  not null default 15,
  add column if not exists daily_review_limit int  not null default 80,
  add column if not exists study_timezone     text not null default 'Asia/Bangkok',
  add column if not exists day_start_hour     int  not null default 4;

alter table public.knowledge_items
  add column if not exists srs_suspended boolean not null default false;

-- The two queue reads are always "one user, one bucket, ordered". Partial
-- indexes keep parked rows and the wrong bucket out of the scan entirely, and
-- are much smaller than knowledge_items_due_idx (0003), which stays for the
-- plain due counts elsewhere in the app.
create index if not exists knowledge_items_review_queue_idx
  on public.knowledge_items (user_id, srs_due)
  where srs_reps > 0 and srs_suspended = false;

create index if not exists knowledge_items_new_queue_idx
  on public.knowledge_items (user_id, created_at)
  where srs_reps = 0 and srs_suspended = false;

-- No new index on review_log: the daily counts filter on (user_id, reviewed_at
-- >= day start), already covered by review_log_user_time_idx (0022). The extra
-- `stability_before is null` test then runs over one day of rows (tens, not
-- thousands), so a partial index there would be dead weight.

-- RLS policies from 0001 are table-wide and cover the new columns as-is.
