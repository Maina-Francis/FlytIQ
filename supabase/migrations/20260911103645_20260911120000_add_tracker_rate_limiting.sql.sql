/*
# Add rate-limiting columns to price_trackers

## Purpose
The price-scanner edge function currently deactivates trackers after a single alert,
meaning users get only one notification per route. This migration adds two columns
that allow the scanner to keep trackers active and rate-limit notifications instead.

## Changes to `price_trackers`
1. `last_notified_at` (timestamptz, nullable) — timestamp of the last alert sent.
   Used to enforce a minimum gap (default 24h) between notifications on the same tracker.
2. `last_seen_price` (decimal, nullable) — the most recent cached price observed
   for this tracker's route. Used by "any price drop" trackers to detect an actual
   drop (current < previous) rather than firing on every scan.

## Security
- No new tables created.
- No RLS policy changes — existing policies remain in effect.
- Both columns are nullable and have no default, so existing rows are unaffected.
*/

-- Add last_notified_at column for rate-limiting
ALTER TABLE public.price_trackers
    ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Add last_seen_price column for any-drop detection
ALTER TABLE public.price_trackers
    ADD COLUMN IF NOT EXISTS last_seen_price DECIMAL(10, 2);

-- Index to speed up the scanner's active-tracker query
CREATE INDEX IF NOT EXISTS idx_price_trackers_active
    ON public.price_trackers (is_active)
    WHERE is_active = true;
