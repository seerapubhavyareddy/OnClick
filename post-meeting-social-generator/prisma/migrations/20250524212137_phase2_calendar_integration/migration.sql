/*
  Warnings:

  - A unique constraint covering the columns `[userId,calendarEventId]` on the table `Meeting` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "attendees" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "recallBotId" TEXT,
ADD COLUMN     "recallBotStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_userId_calendarEventId_key" ON "Meeting"("userId", "calendarEventId");
