CREATE TABLE "ResearchAssistantFeedback" (
  "id" TEXT NOT NULL,
  "vote" TEXT NOT NULL,
  "questionCategory" TEXT NOT NULL,
  "robotId" TEXT,
  "externalSearchUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchAssistantFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchAssistantFeedback_createdAt_idx"
  ON "ResearchAssistantFeedback"("createdAt");
CREATE INDEX "ResearchAssistantFeedback_robotId_createdAt_idx"
  ON "ResearchAssistantFeedback"("robotId", "createdAt");

ALTER TABLE "ResearchAssistantFeedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ResearchAssistantFeedback" FROM anon, authenticated;
