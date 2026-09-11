-- Settings: an on/off switch for auto-applying AI stage suggestions instead
-- of always waiting on a human to confirm them from the Inbox, and a JSON
-- override map for the Funnel view's stage display labels.
ALTER TABLE "Settings" ADD COLUMN "autoApplyStageSuggestions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "funnelStageLabels" JSONB;

-- New StageChangeSource value for a stage change that no one actually
-- confirmed — the auto-apply setting did it.
ALTER TYPE "StageChangeSource" ADD VALUE 'AI_AUTO_APPLIED';
