import { AppError } from "@/lib/backend/errors";
import type { Tone } from "@/lib/types/domain";

export function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new AppError("invalid_slug", "Unable to generate a valid slug.", 400);
  }

  return slug;
}

export function normalizeHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "");

  if (!handle) {
    throw new AppError("invalid_username", "X username is required.", 400);
  }

  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    throw new AppError(
      "invalid_username",
      "X username must be 1-15 characters and use only letters, numbers, or underscores.",
      400,
    );
  }

  return handle;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatRelativeTime(input: string) {
  const timestamp = new Date(input).getTime();
  const diff = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Math.abs(diff) < hour) {
    return formatter.format(Math.round(diff / minute), "minute");
  }

  if (Math.abs(diff) < day) {
    return formatter.format(Math.round(diff / hour), "hour");
  }

  return formatter.format(Math.round(diff / day), "day");
}

export function scoreToTier(score: number) {
  if (score >= 950) return "Immortal Tier";
  if (score >= 900) return "Exalted Tier";
  if (score >= 820) return "Elite Tier";
  if (score >= 700) return "Master Tier";
  return "Emerging Tier";
}

export function scoreTone(score: number): Tone {
  if (score >= 80) return "primary";
  if (score >= 60) return "secondary";
  if (score >= 40) return "neutral";
  return "tertiary";
}

export function sparklineFromScore(score: number) {
  const base = Math.max(20, Math.min(100, Math.round(score)));
  return [
    Math.max(24, Math.round(base * 0.42)),
    Math.max(32, Math.round(base * 0.58)),
    Math.max(36, Math.round(base * 0.76)),
    Math.max(42, Math.round(base * 0.66)),
    Math.max(50, Math.min(100, Math.round(base))),
  ];
}
