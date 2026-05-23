import { buildCachePayload, type CachePayload } from "./payload";

// Minimum cached-token threshold for Gemini Flash. Below this, the API
// rejects the create call. The schema dump + knowledge files easily
// clear this in practice; the guard exists so a freshly-installed env
// with empty analytics schema fails open (no cache) instead of erroring.
const MIN_CACHE_TOKENS = 1024;

// TTL applied to the server-side CachedContent. Short enough to limit
// idle storage charges; long enough that bursty Council-of-Councils
// usage hits the cache for hours of consecutive turns. Override via
// GEMINI_CACHE_TTL_SEC.
const DEFAULT_TTL_SEC = 900;

type CacheState = {
  name: string;
  fingerprint: string;
  expiresAt: number;
  modelId: string;
  systemPromptHash: string;
};

let inflight: Promise<string | null> | null = null;
let state: CacheState | null = null;

function envFlagEnabled(): boolean {
  const v = process.env.GEMINI_CACHE_ENABLED;
  return v === "1" || v === "true";
}

function ttlSec(): number {
  const raw = process.env.GEMINI_CACHE_TTL_SEC;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TTL_SEC;
}

function hashString(s: string): string {
  // Cheap djb2 — we only need an inequality check to invalidate; not
  // a cryptographic hash, not a collision concern at this scale.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

type CreateCacheResponse = {
  name: string;
  usageMetadata?: { totalTokenCount?: number };
};

async function createCache(
  modelId: string,
  payload: CachePayload,
  apiKey: string,
): Promise<{ name: string; tokens: number } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${encodeURIComponent(apiKey)}`;
  const body = {
    model: `models/${modelId}`,
    systemInstruction: { role: "system", parts: [{ text: payload.systemInstruction }] },
    contents: [
      { role: "user", parts: [{ text: payload.cachedUserText }] },
    ],
    ttl: `${ttlSec()}s`,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "<no body>");
    console.warn(
      `[gemini-cache] create failed: ${res.status} ${res.statusText} ${detail.slice(0, 400)}`,
    );
    return null;
  }
  const data = (await res.json()) as CreateCacheResponse;
  const tokens = data.usageMetadata?.totalTokenCount ?? 0;
  if (tokens > 0 && tokens < MIN_CACHE_TOKENS) {
    console.warn(
      `[gemini-cache] payload too small (${tokens} tokens); skipping cache`,
    );
    // Best-effort cleanup of the rejected cache.
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/${data.name}?key=${encodeURIComponent(apiKey)}`,
      { method: "DELETE" },
    ).catch(() => undefined);
    return null;
  }
  return { name: data.name, tokens };
}

export async function getOrCreateCachedContent({
  modelId,
  systemPrompt,
}: {
  modelId: string;
  systemPrompt: string;
}): Promise<string | null> {
  if (!envFlagEnabled()) return null;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  // Serialize concurrent first-misses so one cold start does not fan
  // out into N parallel cache creates.
  if (inflight) return inflight;

  const promptHash = hashString(systemPrompt);
  const now = Date.now();
  if (
    state &&
    state.modelId === modelId &&
    state.systemPromptHash === promptHash &&
    state.expiresAt > now + 30_000
  ) {
    // Schema fingerprint check happens against a fresh payload; cheap
    // re-check (calls the DB) so we only run it when the TTL is not the
    // limiting factor.
    const payload = await buildCachePayload(systemPrompt);
    if (payload.schemaFingerprint === state.fingerprint) {
      return state.name;
    }
  }

  inflight = (async () => {
    try {
      const payload = await buildCachePayload(systemPrompt);
      const created = await createCache(modelId, payload, apiKey);
      if (!created) return null;
      state = {
        name: created.name,
        fingerprint: payload.schemaFingerprint,
        expiresAt: now + ttlSec() * 1000,
        modelId,
        systemPromptHash: promptHash,
      };
      console.info(
        `[gemini-cache] created ${created.name} (${created.tokens} tokens, ttl ${ttlSec()}s)`,
      );
      return created.name;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function __resetCacheStateForTests(): void {
  state = null;
  inflight = null;
}
