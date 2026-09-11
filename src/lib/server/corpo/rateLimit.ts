// Best-effort per-user sliding-window rate limit. In-memory: on Vercel each warm function
// instance has its own map, so this bounds abuse per instance rather than globally. Good
// enough for "≤ 20 sends / 10 min" on an internal tool; a KV-backed limiter can replace it.

interface Bucket {
	hits: number[];
}

const buckets = new Map<string, Bucket>();
const SWEEP_EVERY_MS = 60_000;
let lastSweep = Date.now();

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	/** Seconds until the oldest hit leaves the window (0 when allowed). */
	retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
	if (now - lastSweep > SWEEP_EVERY_MS) sweep(now, windowMs);
	const bucket = buckets.get(key) ?? { hits: [] };
	bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
	if (bucket.hits.length >= limit) {
		buckets.set(key, bucket);
		const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.hits[0])) / 1000));
		return { allowed: false, remaining: 0, retryAfterSec };
	}
	bucket.hits.push(now);
	buckets.set(key, bucket);
	return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

function sweep(now: number, windowMs: number): void {
	lastSweep = now;
	for (const [key, bucket] of buckets) {
		bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
		if (bucket.hits.length === 0) buckets.delete(key);
	}
}

/** Test hook. */
export function resetRateLimits(): void {
	buckets.clear();
}
