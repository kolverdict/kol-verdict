import { AppError } from "@/lib/backend/errors";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { hashSensitiveValue } from "@/lib/backend/logging";

type RateLimitConfig = {
  action: string;
  ipLimit: number;
  ipWindowSeconds: number;
  profileLimit?: number;
  profileWindowSeconds?: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  retry_after_seconds: number;
};

const rateLimitConfigs = {
  createKol: {
    action: "create_kol",
    ipLimit: 12,
    ipWindowSeconds: 60 * 60,
    profileLimit: 5,
    profileWindowSeconds: 60 * 60,
  },
  vote: {
    action: "cast_vote",
    ipLimit: 120,
    ipWindowSeconds: 10 * 60,
    profileLimit: 60,
    profileWindowSeconds: 10 * 60,
  },
  comment: {
    action: "create_comment",
    ipLimit: 24,
    ipWindowSeconds: 60 * 60,
    profileLimit: 12,
    profileWindowSeconds: 60 * 60,
  },
  evidence: {
    action: "attach_evidence",
    ipLimit: 40,
    ipWindowSeconds: 60 * 60,
    profileLimit: 20,
    profileWindowSeconds: 60 * 60,
  },
  walletChallenge: {
    action: "wallet_challenge",
    ipLimit: 10,
    ipWindowSeconds: 15 * 60,
  },
  walletVerify: {
    action: "wallet_verify",
    ipLimit: 20,
    ipWindowSeconds: 15 * 60,
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitAction = keyof typeof rateLimitConfigs;

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

async function checkLimit(config: RateLimitConfig, subject: string, windowSeconds: number, limit: number) {
  const client = createInsForgeServerClient();
  const response = await client.database.rpc("check_and_increment_rate_limit", {
    p_action: config.action,
    p_subject: subject,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (response.error) {
    throw new AppError("rate_limit_check_failed", response.error.message, 500, {
      logDetails: {
        action: config.action,
        subject,
      },
    });
  }

  const result = Array.isArray(response.data) ? response.data[0] : response.data;
  return result as RateLimitResult | undefined;
}

function throwRateLimited(config: RateLimitConfig, scope: "ip" | "profile", subject: string, result?: RateLimitResult) {
  throw new AppError("rate_limited", "Too many attempts. Please wait and try again.", 429, {
    retryAfterSeconds: result?.retry_after_seconds ?? 60,
    logDetails: {
      action: config.action,
      scope,
      subject,
      remaining: result?.remaining ?? 0,
      resetAt: result?.reset_at ?? null,
    },
  });
}

export async function assertRateLimit(request: Request, action: RateLimitAction, profileId?: string | null) {
  const config = rateLimitConfigs[action];
  const ipSubject = `ip:${hashSensitiveValue(getClientIp(request.headers))}`;
  const ipResult = await checkLimit(config, ipSubject, config.ipWindowSeconds, config.ipLimit);

  if (!ipResult?.allowed) {
    throwRateLimited(config, "ip", ipSubject, ipResult);
  }

  if (
    profileId &&
    "profileLimit" in config &&
    typeof config.profileLimit === "number" &&
    "profileWindowSeconds" in config &&
    typeof config.profileWindowSeconds === "number"
  ) {
    const profileSubject = `profile:${profileId}`;
    const profileResult = await checkLimit(config, profileSubject, config.profileWindowSeconds, config.profileLimit);

    if (!profileResult?.allowed) {
      throwRateLimited(config, "profile", profileSubject, profileResult);
    }
  }
}
