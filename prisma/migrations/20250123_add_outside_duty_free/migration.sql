-- Add outside duty-free shopping preferences to Trip
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "outsideDutyFreeOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "outsideDutyFreeTimeBudget" INTEGER;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "outsideDutyFreeMaxStops" INTEGER;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "outsideDutyFreeCategories" TEXT[] DEFAULT '{}';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "outsideDutyFreeConstraints" TEXT;

-- Add index for filtering by opt-in status
CREATE INDEX IF NOT EXISTS "Trip_outsideDutyFreeOptIn_idx" ON "Trip"("outsideDutyFreeOptIn");

-- Add outside duty-free preferences to Request
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "allowOutsideDutyFree" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "storeTypePreference" TEXT;
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "itemFlexibility" TEXT;

-- Add index for filtering by allow outside duty-free
CREATE INDEX IF NOT EXISTS "Request_allowOutsideDutyFree_idx" ON "Request"("allowOutsideDutyFree");
