CREATE TABLE "ResearchAssistantRateLimit" (
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1 CHECK ("count" BETWEEN 1 AND 5),
  PRIMARY KEY ("keyHash", "windowStart")
);
CREATE INDEX "ResearchAssistantRateLimit_windowStart_idx" ON "ResearchAssistantRateLimit" ("windowStart");
ALTER TABLE "ResearchAssistantRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ResearchAssistantRateLimit" FROM PUBLIC, anon, authenticated;
