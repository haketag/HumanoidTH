import { createHash } from "node:crypto";
import { ResearchError } from "./ai/research-errors";
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 5;
const requests = new Map<string, { windowStartedAt: number; count: number }>();

export function clientRateLimitKey(request: Request, trustProxy = process.env.TRUST_PROXY_HEADERS === "true") {
  if (!trustProxy) return "shared-client-bucket";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "local";
}

export function allowGeminiRequest(key: string, now = Date.now()) {
  if (requests.size > 1_000) {
    for (const [candidate, value] of requests) if (now - value.windowStartedAt > WINDOW_MS * 2) requests.delete(candidate);
  }
  const current = requests.get(key);
  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    requests.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function allowResearchRequest(key: string, now = Date.now()): Promise<boolean> {
  const shared = process.env.RESEARCH_RATE_LIMIT_BACKEND === "postgres" || process.env.NODE_ENV === "production";
  if (!shared) return allowGeminiRequest(key, now);
  const keyHash = createHash("sha256").update(key).digest("hex");
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  try {
    const { prisma } = await import("./prisma");
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "ResearchAssistantRateLimit" ("keyHash", "windowStart", "count")
      VALUES (${keyHash}, ${windowStart}, 1)
      ON CONFLICT ("keyHash", "windowStart") DO UPDATE
      SET "count" = "ResearchAssistantRateLimit"."count" + 1
      WHERE "ResearchAssistantRateLimit"."count" < ${REQUESTS_PER_WINDOW}
      RETURNING "count"
    `;
    await prisma.$executeRaw`DELETE FROM "ResearchAssistantRateLimit" WHERE "windowStart" < ${new Date(now - 86_400_000)}`;
    return rows.length === 1;
  } catch { throw new ResearchError("RATE_LIMIT_UNAVAILABLE", "rate_limit_storage"); }
}
