/*
  Warnings:

  - Made the column `calendarEventId` on table `Meeting` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastPolledAt" TIMESTAMP(3),
ADD COLUMN     "pollRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transcript" JSONB,
ADD COLUMN     "transcriptText" TEXT,
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "calendarEventId" SET NOT NULL;
