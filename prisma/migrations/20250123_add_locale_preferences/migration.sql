-- Add locale preferences to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredCountry" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

-- Create index for locale filtering (useful for batch emails by locale)
CREATE INDEX IF NOT EXISTS "User_preferredLocale_idx" ON "User"("preferredLocale");
CREATE INDEX IF NOT EXISTS "User_preferredLanguage_idx" ON "User"("preferredLanguage");
