-- AlterTable
ALTER TABLE "members" ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "members" ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
