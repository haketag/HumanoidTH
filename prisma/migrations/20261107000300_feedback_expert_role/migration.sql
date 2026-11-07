ALTER TABLE "ResearchAssistantFeedback"
  ADD COLUMN "expertRole" TEXT;

ALTER TABLE "ResearchAssistantFeedback"
  ADD CONSTRAINT "ResearchAssistantFeedback_expertRole_check"
  CHECK ("expertRole" IS NULL OR "expertRole" IN ('robotics_engineer', 'research_scientist', 'hri_wellness_specialist'));
