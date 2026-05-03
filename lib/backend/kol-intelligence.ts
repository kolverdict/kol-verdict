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

async function deriveGlobalRank(kolId: string) {
  const client = createInsForgeServerClient();
  const [kolsResponse, metricsResponse] = await Promise.all([
    client.database
      .from("kols")
      .select("id, slug, initial_trust_score")
      .eq("status", "active"),
    client.database.from("kol_metrics_cache").select("kol_id, trust_score, trending_score"),
  ]);

  if (kolsResponse.error) {
    throw kolsResponse.error;
  }

  if (metricsResponse.error) {
    throw metricsResponse.error;
  }

  const metricsByKolId = new Map(
    (((metricsResponse.data as Array<Pick<KolMetricsCacheRow, "kol_id" | "trust_score" | "trending_score">>) ?? [])).map((row) => [
      row.kol_id,
      row,
    ]),
  );
  const rankedRows =
    (((kolsResponse.data as Array<Pick<KolRow, "id" | "slug" | "initial_trust_score">>) ?? []))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        trustScore: Number(metricsByKolId.get(row.id)?.trust_score ?? row.initial_trust_score ?? 0),
        trendingScore: Number(metricsByKolId.get(row.id)?.trending_score ?? 0),
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
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new AppError("kol_not_found", "KOL not found.", 404);
  }

  const row = response.data as KolRow;
  const [metricsCacheResponse, profileMetricsResponse, reasoningPointsResponse, recentSignalsResponse, dataSourcesResponse, xProfileResponse] =
    await Promise.all([
      client.database.from("kol_metrics_cache").select("*").eq("kol_id", row.id).maybeSingle(),
      client.database.from("kol_profile_metrics").select("*").eq("kol_id", row.id).maybeSingle(),
      client.database.from("kol_reasoning_points").select("*").eq("kol_id", row.id).order("sort_order", { ascending: true }),
      client.database.from("kol_recent_signals").select("*").eq("kol_id", row.id).order("published_at", { ascending: false }),
      client.database.from("kol_data_sources").select("*").eq("kol_id", row.id).order("created_at", { ascending: false }),
      client.database.from("kol_x_profiles").select("*").eq("kol_id", row.id).maybeSingle(),
    ]);

  if (metricsCacheResponse.error) {
    throw metricsCacheResponse.error;
  }

  if (profileMetricsResponse.error) {
    throw profileMetricsResponse.error;
  }

  if (reasoningPointsResponse.error) {
    throw reasoningPointsResponse.error;
  }

  if (recentSignalsResponse.error) {
    throw recentSignalsResponse.error;
  }

  if (dataSourcesResponse.error) {
    throw dataSourcesResponse.error;
  }

  if (xProfileResponse.error) {
    throw xProfileResponse.error;
  }

  const normalized = normalizeKolProfileDetail({
    kol: row,
    metricsCache: (metricsCacheResponse.data as KolMetricsCacheRow | null) ?? null,
    profileMetrics: (profileMetricsResponse.data as KolProfileMetricsRow | null) ?? null,
    reasoningPoints: (reasoningPointsResponse.data as KolReasoningPointRow[] | null) ?? [],
    recentSignals: (recentSignalsResponse.data as KolRecentSignalRow[] | null) ?? [],
    dataSources: (dataSourcesResponse.data as KolDataSourceRow[] | null) ?? [],
    xProfile: (xProfileResponse.data as KolXProfileRow | null) ?? null,
    derivedGlobalRank: await deriveGlobalRank(row.id),
  });

  if (!getEnv().ALLOW_SYNTHETIC_PROFILE_FILL) {
    return normalized;
  }

  return applySyntheticProfileFallback(normalized).profile;
}
