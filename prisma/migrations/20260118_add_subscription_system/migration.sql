-- Add Subscription System Migration
-- Created: 2026-01-18
-- Description: Adds subscription plans, user subscriptions, FX rates, and updates Order model

-- Create SubscriptionTier enum
CREATE TYPE "SubscriptionTier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

-- Create SubscriptionStatus enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT');

-- Create SubscriptionPlan table
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceEur" DOUBLE PRECISION NOT NULL,
    "pricePln" DOUBLE PRECISION NOT NULL,
    "purchaseLimit" INTEGER,
    "description" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- Create unique index on tier
CREATE UNIQUE INDEX "SubscriptionPlan_tier_key" ON "SubscriptionPlan"("tier");
CREATE INDEX "SubscriptionPlan_tier_idx" ON "SubscriptionPlan"("tier");
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- Create Subscription table
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "purchasesUsed" INTEGER NOT NULL DEFAULT 0,
    "purchaseLimit" INTEGER,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "amountPaid" DOUBLE PRECISION,
    "fxRateUsed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Subscription
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- Add foreign keys for Subscription
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create FxRate table
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- Create indexes for FxRate
CREATE UNIQUE INDEX "FxRate_fromCurrency_toCurrency_validFrom_key" ON "FxRate"("fromCurrency", "toCurrency", "validFrom");
CREATE INDEX "FxRate_fromCurrency_toCurrency_idx" ON "FxRate"("fromCurrency", "toCurrency");
CREATE INDEX "FxRate_validFrom_idx" ON "FxRate"("validFrom");

-- Update Order table with new fee structure
ALTER TABLE "Order" ADD COLUMN "goodsValue" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "travellerServiceFee" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "fxRateUsed" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "originalCurrency" TEXT;

-- Make legacy columns optional
ALTER TABLE "Order" ALTER COLUMN "productPrice" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "serviceFee" DROP NOT NULL;

-- Migrate existing data: copy productPrice to goodsValue, serviceFee to travellerServiceFee
UPDATE "Order" SET "goodsValue" = "productPrice" WHERE "goodsValue" IS NULL;
UPDATE "Order" SET "travellerServiceFee" = "serviceFee" WHERE "travellerServiceFee" IS NULL;

-- Make new columns required after migration
ALTER TABLE "Order" ALTER COLUMN "goodsValue" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "travellerServiceFee" SET NOT NULL;

-- Seed initial subscription plans
INSERT INTO "SubscriptionPlan" ("id", "tier", "name", "priceEur", "pricePln", "purchaseLimit", "description", "features", "isActive", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::TEXT, 'SILVER', 'Silver', 4.63, 19.99, 5, 'Perfect for occasional travelers', ARRAY['Up to 5 purchases per year', 'Standard support', 'Basic tracking'], true, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'GOLD', 'Gold', 6.94, 29.99, 10, 'For regular travelers', ARRAY['Up to 10 purchases per year', 'Priority support', 'Advanced tracking', 'Early access to deals'], true, NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'PLATINUM', 'Platinum', 11.57, 49.99, NULL, 'For power users', ARRAY['Unlimited purchases', 'VIP support', 'Premium tracking', 'Exclusive deals', 'Priority matching'], true, NOW(), NOW());

-- Seed initial FX rates
INSERT INTO "FxRate" ("id", "fromCurrency", "toCurrency", "rate", "source", "validFrom", "createdAt")
VALUES
    (gen_random_uuid()::TEXT, 'EUR', 'PLN', 4.32, 'seed', NOW(), NOW()),
    (gen_random_uuid()::TEXT, 'PLN', 'EUR', 0.2315, 'seed', NOW(), NOW());
