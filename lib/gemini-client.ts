import { createHash } from "node:crypto";

type Result = { status: number; text: string };
type Input = { apiKey: string; model: string; body: unknown; timeoutMs?: number };
type Options = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  baseDelayMs?: number;
  maxRetries?: number;
  cacheTtlMs?: number;
  attemptTimeoutMs?: number;
};

const transientStatuses = new Set([429, 500, 502, 503, 504]);

// Limits are per Node process. Multiple server instances need a shared limiter.
export function createGeminiTransport(options: Options = {}) {
  const fetcher = options.fetch ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const inFlight = new Map<string, Promise<Result>>();
  const cache = new Map<string, { expires: number; result: Result }>();
  const queue: Array<() => void> = [];
  let active = false;
  let notBefore = 0;

  function schedule(task: () => Promise<Result>, deadline: number): Promise<Result> {
    if (queue.length >= 16) return Promise.reject(new Error("Gemini is busy. Please try again shortly."));
    return new Promise((resolve, reject) => {
      const start = () => {
        clearTimeout(timer);
        active = true;
        task().then(resolve, reject).finally(() => {
          active = false;
          queue.shift()?.();
        });
      };
      const timer = setTimeout(() => {
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        reject(new Error("Gemini request expired while waiting. Please try again."));
      }, Math.max(1, deadline - now()));
      if (active) queue.push(start); else start();
    });
  }

  async function perform(input: Input, body: string, deadline: number): Promise<Result> {
    let lastResponse: Result | undefined;
    for (let attempt = 0; attempt <= (options.maxRetries ?? 3); attempt++) {
      const wait = Math.max(0, notBefore - now());
      if (wait >= deadline - now()) {
        if (lastResponse) return lastResponse;
        throw new Error("Gemini is temporarily busy. Please try again shortly.");
      }
      if (wait) await sleep(wait);
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error("Gemini request timed out. Please try again.");
      let retryAfterMs = 0;
      try {
        const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
          body,
          cache: "no-store",
          signal: AbortSignal.timeout(Math.max(1, Math.min(remaining, options.attemptTimeoutMs ?? 15_000)))
        });
        lastResponse = { status: response.status, text: (await response.text()).replaceAll(input.apiKey, "[REDACTED]") };
        if (!transientStatuses.has(response.status)) return lastResponse;
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retryAfter) - now()) || 0;
        }
      } catch (error) {
        // Fetch/network timeouts may be transient; invalid credentials return an
        // HTTP response and are deliberately never retried.
        if (!(error instanceof TypeError) && !(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) throw error;
        if (attempt === (options.maxRetries ?? 3)) throw new Error("Gemini connection timed out or is unavailable. Please try again.");
      }
      const delay = Math.max(retryAfterMs, (options.baseDelayMs ?? 2000) * 2 ** attempt + Math.floor(random() * 500));
      notBefore = now() + delay;
    }
    return lastResponse!;
  }

  return async (input: Input): Promise<Response> => {
    const body = JSON.stringify(input.body);
    const key = createHash("sha256").update(JSON.stringify([input.apiKey, input.model, body])).digest("hex");
    for (const [key, entry] of cache) if (entry.expires <= now()) cache.delete(key);
    const cached = cache.get(key);
    let result = cached?.result;
    if (!result) {
      let pending = inFlight.get(key);
      if (!pending) {
        const deadline = now() + (input.timeoutMs ?? 45_000);
        pending = schedule(() => perform(input, body, deadline), deadline);
        // Deadline includes queue time as well as upstream calls and retries.
        inFlight.set(key, pending);
        pending.then(value => {
          if (value.status >= 200 && value.status < 300 && value.text.length <= 128_000) {
            if (cache.size >= 32) cache.delete(cache.keys().next().value!);
            cache.set(key, { expires: now() + (options.cacheTtlMs ?? 60_000), result: value });
          }
        }).finally(() => inFlight.delete(key)).catch(() => {});
      }
      result = await pending;
    }
    return new Response(result.text, { status: result.status, headers: { "Content-Type": "application/json" } });
  };
}

const globalForGemini = globalThis as unknown as { geminiTransport?: ReturnType<typeof createGeminiTransport> };

export async function generateWithGemini(body: unknown, options: { timeoutMs?: number } = {}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || !model) throw new Error("GEMINI_API_KEY and GEMINI_MODEL must be configured.");
  globalForGemini.geminiTransport ??= createGeminiTransport();
  return globalForGemini.geminiTransport({ apiKey, model, body, ...options });
}
