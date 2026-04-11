import { AppError } from "@/lib/backend/errors";
import { applySyntheticProfileFallback } from "@/lib/backend/kol-intelligence-fallback";
import { normalizeKolProfileDetail } from "@/lib/backend/kol-intelligence-normalizer";
import { getEnv } from "@/lib/env";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { KolProfileDetail } from "@/lib/types/api";
import type {
  KolDataSourceRow,
  KolMetricsCacheRow,
  KolProfileMetricsRow,
  KolRecentSignalRow,
  KolReasoningPointRow,
  KolRow,
  KolXProfileRow,
} from "@/lib/types/db";

type JoinedKolIntelligenceRow = KolRow & {
  kol_metrics_cache?: KolMetricsCacheRow | KolMetricsCacheRow[] | null;
  kol_profile_metrics?: KolProfileMetricsRow | KolProfileMetricsRow[] | null;
  kol_reasoning_points?: KolReasoningPointRow[] | null;
  kol_recent_signals?: KolRecentSignalRow[] | null;
  kol_data_sources?: KolDataSourceRow[] | null;
  kol_x_profiles?: KolXProfileRow | KolXProfileRow[] | null;
};

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return toArray(value)[0] ?? null;
}

async function deriveGlobalRank(kolId: string) {
  const client = createInsForgeServerClient();
  const response = await client.database
    .from("kols")
    .select("id, slug, initial_trust_score, kol_metrics_cache(trust_score, trending_score)")
    .eq("status", "active");

  if (response.error) {
    throw response.error;
  }

  const rankedRows =
    ((response.data as Array<
      Pick<KolRow, "id" | "slug" | "initial_trust_score"> & {
        kol_metrics_cache?: KolMetricsCacheRow | KolMetricsCacheRow[] | null;
      }
    > | null) ?? [])
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        trustScore: Number(firstRelation(row.kol_metrics_cache)?.trust_score ?? row.initial_trust_score ?? 0),
        trendingScore: Number(firstRelation(row.kol_metrics_cache)?.trending_score ?? 0),
      }))
      .sort((left, right) => {
        if (right.trustScore !== left.trustScore) {
          return right.trustScore - left.trustScore;
        }

        if (right.trendingScore !== left.trendingScore) {
          return right.trendingScore - left.trendingScore;
        }

        return left.slug.localeCompare(right.slug);
      });

  const rank = rankedRows.findIndex((row) => row.id === kolId);
  return rank >= 0 ? rank + 1 : null;
}

export async function getKolProfileDetail(slug: string): Promise<KolProfileDetail> {
  const client = createInsForgeServerClient();
  const response = await client.database
    .from("kols")
    .select(
      [
        "*",
        "kol_metrics_cache(*)",
        "kol_profile_metrics(*)",
        "kol_reasoning_points(*)",
        "kol_recent_signals(*)",
        "kol_data_sources(*)",
        "kol_x_profiles(*)",
      ].join(", "),
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new AppError("kol_not_found", "KOL not found.", 404);
  }

  const row = response.data as unknown as JoinedKolIntelligenceRow;
  const normalized = normalizeKolProfileDetail({
    kol: row,
    metricsCache: firstRelation(row.kol_metrics_cache),
    profileMetrics: firstRelation(row.kol_profile_metrics),
    reasoningPoints: toArray(row.kol_reasoning_points),
    recentSignals: toArray(row.kol_recent_signals),
    dataSources: toArray(row.kol_data_sources),
    xProfile: firstRelation(row.kol_x_profiles),
    derivedGlobalRank: await deriveGlobalRank(row.id),
  });

  if (!getEnv().ALLOW_SYNTHETIC_PROFILE_FILL) {
    return normalized;
  }

  return applySyntheticProfileFallback(normalized).profile;
}
