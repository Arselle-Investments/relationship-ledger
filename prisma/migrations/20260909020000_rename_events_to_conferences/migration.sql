-- Renames Event -> Conference (table, enum type, and index) in place so all
-- existing rows survive, per the team's request to rename Events to
-- Conferences everywhere including the URL. Also adds seriesId for
-- year-over-year recurrence tracking.

ALTER TABLE "Event" RENAME TO "Conference";
ALTER TYPE "EventType" RENAME TO "ConferenceType";
ALTER INDEX "Event_startDate_idx" RENAME TO "Conference_startDate_idx";

ALTER TABLE "Conference" ADD COLUMN "seriesId" TEXT;
CREATE INDEX "Conference_seriesId_idx" ON "Conference"("seriesId");
