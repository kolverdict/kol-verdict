import { createInsForgeServerClient } from "@/lib/insforge/server";
import { formatCompactNumber, scoreToTier, sparklineFromScore } from "@/lib/backend/mappers";
import type {
  LeaderboardEntryView,
  LeaderboardSnapshot,
  LeaderboardTab,
  StatCardView,
} from "@/lib/types/domain";
import type { KolMetricsCacheRow, KolRow, ProfileRow } from "@/lib/types/db";

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function sortEntries(entries: LeaderboardEntryView[], tab: LeaderboardTab) {
  const sorted = [...entries];
  sorted.sort((left, right) => {
    if (tab === "trusted") return right.trustScore - left.trustScore;
    if (tab === "hated") return right.hateScore - left.hateScore;
    return right.trendingScore - left.trendingScore;
  });

  return sorted;
}

function mapRealEntry(kol: KolRow, metrics?: Partial<KolMetricsCacheRow>): LeaderboardEntryView {
  const trustScore = Number(metrics?.trust_score ?? kol.initial_trust_score ?? 0);
  const hateScore = metrics?.hate_count ?? 0;
  const trendingScore = metrics?.trending_score ?? 0;
  const loveCount = metrics?.love_count ?? 0;
  const verdictCount = loveCount + hateScore;
  const total = Math.max(1, verdictCount);
  const bullishPercent = Math.round((loveCount / total) * 100);
  const sentimentCount = loveCount + hateScore + (metrics?.total_comments ?? 0);
  const trendValue = Math.max(0, trendingScore / 10);

  return {
    slug: kol.slug,
    handle: `@${kol.x_username}`,
    displayName: kol.display_name ?? kol.x_username,
    image: kol.avatar_url ?? null,
    subtitle: kol.bio?.trim() || `${kol.wallet_address ? "Wallet-linked" : "Registry-tracked"} profile`,
    trustScore: Math.round(trustScore * 10),
    hateScore,
    trendingScore,
    verdictCount,
    verdictCountLabel: `${formatCompactNumber(verdictCount)} ${verdictCount === 1 ? "verdict" : "verdicts"}`,
    bullishPercent,
    tier: scoreToTier(Math.round(trustScore * 10)),
    sparkline: sparklineFromScore(trustScore),
    verified: Boolean(kol.wallet_address) || Boolean(kol.verified) || sentimentCount >= 5,
    flowLabel: `${formatCompactNumber(verdictCount)} SIGNALS`,
    trendLabel: `+${trendValue.toFixed(1)}% ${trendingScore >= 60 ? "GAIN" : "STABLE"}`,
    trendTone: trendingScore >= 60 ? "primary" : "secondary",
    muted: trustScore < 80,
  };
}

function buildRealStats(
  entries: Array<KolRow & { kol_metrics_cache?: KolMetricsCacheRow | KolMetricsCacheRow[] | null }>,
  profiles: Array<Pick<ProfileRow, "reputation_score">>,
): StatCardView[] {
  const activeOracles = entries.length;
  const metrics = entries.map((entry) => firstRelation(entry.kol_metrics_cache));
  const trustScores = metrics.map((metric, index) =>
    Number(metric?.trust_score ?? entries[index]?.initial_trust_score ?? 0),
  );
  const averageTrust = trustScores.length > 0 ? trustScores.reduce((sum, value) => sum + value, 0) / trustScores.length : 0;
  const totalScamsFlagged = metrics.reduce((sum, metric) => sum + Number(metric?.hate_count ?? 0), 0);
  const reputationMinted = profiles.reduce((sum, profile) => sum + Number(profile.reputation_score ?? 0), 0);

  return [
    {
      label: "Network Veracity",
      value: `${averageTrust.toFixed(1)}%`,
      meta: "Live Avg",
      tone: "primary",
    },
    {
      label: "Active Oracles",
      value: formatCompactNumber(activeOracles),
      meta: "Registry",
      tone: "secondary",
    },
    {
      label: "Total Scams Flagged",
      value: formatCompactNumber(totalScamsFlagged),
      meta: "Community",
      tone: "tertiary",
    },
    {
      label: "Reputation Minted",
      value: formatCompactNumber(reputationMinted),
      meta: "Profiles",
      tone: "neutral",
    },
  ];
}

export async function getLeaderboardSnapshot(tab: LeaderboardTab): Promise<LeaderboardSnapshot> {
  const client = createInsForgeServerClient();
  const [kolsResponse, metricsResponse, profilesResponse] = await Promise.all([
    client.database
      .from("kols")
      .select("id, slug, x_username, display_name, avatar_url, bio, wallet_address, verified, initial_trust_score")
      .eq("status", "active"),
    client.database.from("kol_metrics_cache").select("*"),
    client.database.from("profiles").select("reputation_score"),
  ]);

  if (kolsResponse.error) {
    throw kolsResponse.error;
  }

  if (metricsResponse.error) {
    throw metricsResponse.error;
  }

  if (profilesResponse.error) {
    throw profilesResponse.error;
  }

  const rows = (kolsResponse.data as KolRow[] | null) ?? [];
  const metricsByKolId = new Map(
    (((metricsResponse.data as KolMetricsCacheRow[] | null) ?? [])).map((row) => [row.kol_id, row]),
  );
  const entries = sortEntries(
    rows.map((row) => mapRealEntry(row, metricsByKolId.get(row.id))),
    tab,
  );

  return {
    tab,
    stats: buildRealStats(
      rows.map((row) => ({
        ...row,
        kol_metrics_cache: metricsByKolId.get(row.id) ?? null,
      })),
      (profilesResponse.data as Array<Pick<ProfileRow, "reputation_score">>) ?? [],
    ),
    entries,
    total: entries.length,
  };
}
