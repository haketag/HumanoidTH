import { z } from "zod";
import { EXPERT_ROLE_IDS } from "./expert-roles";

export const researchFeedbackSchema = z.object({
  vote: z.enum(["HELPFUL", "NOT_HELPFUL"]),
  questionCategory: z.enum(["comparison", "current_information", "recommendation", "robot_detail", "catalog", "research", "general"]).default("general"),
  expertRole: z.enum(EXPERT_ROLE_IDS).nullable().optional(),
  robotId: z.string().trim().min(1).max(128).nullable().optional(),
  externalSearchUsed: z.boolean().default(false),
  issueCategory: z.enum(["incorrect", "missing_information", "broken_source"]).nullable().optional(),
  comment: z.string().trim().max(500).default("")
});
