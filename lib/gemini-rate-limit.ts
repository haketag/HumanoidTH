const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 5;
const requests = new Map<string, { windowStartedAt: number; count: number }>();

export function clientRateLimitKey(request: Request) {
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
