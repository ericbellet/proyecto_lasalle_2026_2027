-- Trace an influencer recommendation back to the exact source video without
-- changing the immutable prediction payload or any scoring input.
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "source_url" text;
