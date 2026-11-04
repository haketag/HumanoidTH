CREATE TABLE "LivingLabPlan" (
  "id" TEXT NOT NULL,
  "ownerTokenHash" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL DEFAULT '',
  "steps" TEXT NOT NULL DEFAULT '',
  "question" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'general',
  "participantGroup" TEXT NOT NULL DEFAULT '',
  "participantCount" TEXT NOT NULL DEFAULT '',
  "siteContext" TEXT NOT NULL DEFAULT '',
  "activityGoal" TEXT NOT NULL DEFAULT '',
  "sessionLength" TEXT NOT NULL DEFAULT '',
  "staffing" TEXT NOT NULL DEFAULT '',
  "readinessNotes" TEXT NOT NULL DEFAULT '',
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "evidenceSnapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LivingLabPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingLabPlanRevision" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "feedback" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingLabPlanRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LivingLabPlan_ownerTokenHash_updatedAt_idx" ON "LivingLabPlan"("ownerTokenHash", "updatedAt");
CREATE INDEX "LivingLabPlanRevision_planId_createdAt_idx" ON "LivingLabPlanRevision"("planId", "createdAt");
ALTER TABLE "LivingLabPlanRevision" ADD CONSTRAINT "LivingLabPlanRevision_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LivingLabPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
