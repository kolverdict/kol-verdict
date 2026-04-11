import type { KolProfileDetail, KolSourceMeta } from "@/lib/types/api";
import type {
  KolDataSourceRow,
  KolMetricsCacheRow,
  KolProfileMetricsRow,
  KolRecentSignalRow,
  KolReasoningPointRow,
  KolRow,
  KolXProfileRow,
} from "@/lib/types/db";

export type KolIntelligenceNormalizationInput = {
  kol: KolRow;
  metricsCache: KolMetricsCacheRow | null;
  profileMetrics: KolProfileMetricsRow | null;
  reasoningPoints: KolReasoningPointRow[];
  recentSignals: KolRecentSignalRow[];
  dataSources: KolDataSourceRow[];
  xProfile: KolXProfileRow | null;
  derivedGlobalRank: number | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: number | string | null | undefined) {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function latestSourceRow(rows: KolDataSourceRow[]) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.fetched_at ?? left.created_at).getTime();
    const rightTime = new Date(right.fetched_at ?? right.created_at).getTime();
    return rightTime - leftTime;
  })[0] ?? null;
}

export function formatDisplayNameFromHandle(xUsername: string) {
  const normalized = xUsername.replace(/[_-]+/g, " ").trim();
  return normalized.length > 0 ? normalized : xUsername;
}

export function deriveVerdictLabel(score: number | null) {
  if (score === null) {
    return null;
  }

  if (score >= 80) {
    return "Low Risk / High Trust";
  }

  if (score >= 65) {
    return "Moderate Risk / Mixed Signals";
  }

  return "High Volatility / Review Carefully";
}

export function deriveRiskLevel(score: number | null) {
  if (score === null) {
    return null;
  }

  if (score >= 80) {
    return "low";
  }

  if (score >= 65) {
    return "moderate";
  }

  return "high";
}

export function deriveActivityLabel({
  verified,
  signalCount,
  totalComments,
  trustScore,
}: {
  verified: boolean;
  signalCount: number;
  totalComments: number;
  trustScore: number | null;
}) {
  if (verified && signalCount >= 2) {
    return "Verified active profile";
  }

  if (verified) {
    return "Verified profile";
  }

  if (signalCount >= 2 || totalComments > 0) {
    return "Community watched";
  }

  if (trustScore !== null && trustScore >= 80) {
    return "High-trust profile";
  }

  return "Registry tracked";
}

export function deriveVerdictSummary({
  displayName,
  trustScore,
  bio,
}: {
  displayName: string;
  trustScore: number | null;
  bio: string | null;
}) {
  if (trustScore === null) {
    return null;
  }

  const bioSentence = bio ? ` ${bio}` : "";

  if (trustScore >= 80) {
    return `${displayName} currently shows stronger trust signals than most tracked profiles, with cleaner audience quality and more disciplined commentary.${bioSentence}`.trim();
  }

  if (trustScore >= 65) {
    return `${displayName} has credible upside signals, but conviction still depends on steadier follow-through and stronger supporting evidence.${bioSentence}`.trim();
  }

  return `${displayName} carries elevated risk signals right now, so any public calls should be reviewed carefully before being treated as dependable guidance.${bioSentence}`.trim();
}

function buildSourceMeta(input: KolIntelligenceNormalizationInput): KolSourceMeta {
  const latestLoggedSource = latestSourceRow(input.dataSources);
  const lastUpdatedAt = latestTimestamp(
    input.profileMetrics?.updated_at,
    latestLoggedSource?.fetched_at,
    input.xProfile?.synced_at,
    input.xProfile?.updated_at,
    input.metricsCache?.updated_at,
    input.kol.updated_at,
  );

  if (input.profileMetrics) {
    return {
      dataSource: input.profileMetrics.data_source,
      dataConfidence: input.profileMetrics.data_confidence,
      isPlaceholder: input.profileMetrics.is_placeholder,
      lastUpdatedAt,
    };
  }

  if (latestLoggedSource) {
    return {
      dataSource: latestLoggedSource.source_type,
      dataConfidence: latestLoggedSource.source_type === "x_api" ? "high" : "medium",
      isPlaceholder: false,
      lastUpdatedAt,
    };
  }

  if (input.xProfile) {
    return {
      dataSource: "x_api",
      dataConfidence: "high",
      isPlaceholder: false,
      lastUpdatedAt,
    };
  }

  return {
    dataSource: "insforge_existing",
    dataConfidence: "medium",
    isPlaceholder: false,
    lastUpdatedAt,
  };
}

export function normalizeKolProfileDetail(input: KolIntelligenceNormalizationInput): KolProfileDetail {
  const displayName = normalizeText(input.kol.display_name) ?? formatDisplayNameFromHandle(input.kol.x_username);
  const handle = `@${input.kol.x_username}`;
  const avatarUrl = normalizeText(input.xProfile?.profile_image_url) ?? normalizeText(input.kol.avatar_url);
  const bio = normalizeText(input.kol.bio);
  const verified = Boolean(input.kol.verified) || Boolean(input.xProfile?.verified);
  const trustScore =
    toNullableInteger(input.profileMetrics?.trust_score) ??
    toNullableInteger(input.metricsCache?.trust_score) ??
    toNullableInteger(input.kol.initial_trust_score);
  const followersCount =
    toNullableInteger(input.profileMetrics?.followers_count) ??
    toNullableInteger(input.xProfile?.followers_count);
  const followingCount =
    toNullableInteger(input.profileMetrics?.following_count) ??
    toNullableInteger(input.xProfile?.following_count);
  const tweetsCount =
    toNullableInteger(input.profileMetrics?.tweets_count) ??
    toNullableInteger(input.xProfile?.tweets_count);
  const verifiedFollowersCount =
    toNullableInteger(input.profileMetrics?.verified_followers_count) ??
    toNullableInteger(input.xProfile?.verified_followers_count);
  const globalRank =
    toNullableInteger(input.profileMetrics?.global_rank) ??
    input.derivedGlobalRank;
  const recentSignals = [...input.recentSignals].sort((left, right) => {
    const leftTime = new Date(left.published_at ?? left.created_at).getTime();
    const rightTime = new Date(right.published_at ?? right.created_at).getTime();
    return rightTime - leftTime;
  });
  const reasoningPoints = [...input.reasoningPoints].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });

  return {
    id: input.kol.id,
    slug: input.kol.slug,
    handle,
    displayName,
    avatarUrl,
    bio,
    verified,
    trustScore,
    followersCount,
    followingCount,
    tweetsCount,
    verifiedFollowersCount,
    globalRank,
    activityLabel:
      normalizeText(input.profileMetrics?.activity_label) ??
      deriveActivityLabel({
        verified,
        signalCount: recentSignals.length,
        totalComments: input.metricsCache?.total_comments ?? 0,
        trustScore,
      }),
    verdictLabel:
      normalizeText(input.profileMetrics?.verdict_label) ??
      deriveVerdictLabel(trustScore),
    verdictSummary:
      normalizeText(input.profileMetrics?.verdict_summary) ??
      deriveVerdictSummary({
        displayName,
        trustScore,
        bio,
      }),
    riskLevel:
      normalizeText(input.profileMetrics?.risk_level) ??
      deriveRiskLevel(trustScore),
    reasoningPoints: reasoningPoints.map((point) => ({
      id: point.id,
      content: point.content,
      sortOrder: point.sort_order,
    })),
    recentSignals: recentSignals.map((signal) => ({
      id: signal.id,
      signalCode: normalizeText(signal.signal_code),
      title: signal.title,
      statusLabel: normalizeText(signal.status_label),
      description: normalizeText(signal.description),
      impactLabel: normalizeText(signal.impact_label),
      publishedAt: signal.published_at,
    })),
    sourceMeta: buildSourceMeta(input),
  };
}
