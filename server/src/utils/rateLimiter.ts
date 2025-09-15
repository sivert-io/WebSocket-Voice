import consola from "consola";

export type RateLimitKeyParts = {
	userId?: string;
	ip?: string;
	event: string;
};

export interface RateLimitRule {
	limit: number; // max events
	windowMs: number; // sliding window size
	banMs?: number; // optional temporary ban duration when exceeded
}

type TimestampQueue = number[];

class SlidingWindowLimiter {
	private buckets: Map<string, TimestampQueue> = new Map();
	private bans: Map<string, number> = new Map();

	constructor(private defaultRule: RateLimitRule) {}

	private key(parts: RateLimitKeyParts): string {
		const uid = parts.userId || "anonymous";
		const ip = parts.ip || "unknown";
		return `${parts.event}:${uid}:${ip}`;
	}

	check(parts: RateLimitKeyParts, rule?: RateLimitRule): { allowed: boolean; retryAfterMs?: number; bannedUntil?: number } {
		const now = Date.now();
		const effective = rule || this.defaultRule;
		const k = this.key(parts);

		const bannedUntil = this.bans.get(k);
		if (bannedUntil && bannedUntil > now) {
			return { allowed: false, bannedUntil };
		} else if (bannedUntil && bannedUntil <= now) {
			this.bans.delete(k);
		}

		let q = this.buckets.get(k);
		if (!q) {
			q = [];
			this.buckets.set(k, q);
		}

		// Evict old timestamps outside window
		const windowStart = now - effective.windowMs;
		while (q.length > 0 && q[0] < windowStart) q.shift();

		if (q.length >= effective.limit) {
			const retryAfterMs = Math.max(0, (q[0] + effective.windowMs) - now);
			if (effective.banMs && !this.bans.has(k)) {
				this.bans.set(k, now + effective.banMs);
				consola.warn("🚫 Rate limit ban applied", { key: k, banMs: effective.banMs });
			}
			return { allowed: false, retryAfterMs, bannedUntil: this.bans.get(k) };
		}

		q.push(now);
		return { allowed: true };
	}
}

// Global limiter instance (process-local). For multi-instance deployments, consider Redis.
export const limiter = new SlidingWindowLimiter({ limit: 100, windowMs: 60_000 });

export function checkRateLimit(event: string, userId?: string, ip?: string, rule?: RateLimitRule) {
	return limiter.check({ event, userId, ip }, rule);
}


