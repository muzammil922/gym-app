-- Align users table with Prisma schema (auth needsPassword / password flow)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMPTZ(3);
