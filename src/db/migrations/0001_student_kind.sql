ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'student' NOT NULL;
