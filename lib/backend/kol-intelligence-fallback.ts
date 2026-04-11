import type { KolProfileDetail } from "@/lib/types/api";

function buildSeed(value: string) {
  return value.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function seededInteger(seed: number, min: number, max: number) {
  if (max <= min) {
    return min;
  }

  return min + (seed % (max - min + 1));
}

export function applySyntheticProfileFallback(profile: KolProfileDetail): {
  profile: KolProfileDetail;
  usedSynthetic: boolean;
} {
  const missingCounts =
    profile.followersCount === null ||
    profile.followingCount === null ||
    profile.tweetsCount === null ||
    profile.verifiedFollowersCount === null;
  const missingReasoning = profile.reasoningPoints.length === 0;
  const missingSignals = profile.recentSignals.length === 0;

  if (!missingCounts && !missingReasoning && !missingSignals) {
    return {
      profile,
      usedSynthetic: false,
    };
  }

  const seed = buildSeed(profile.slug || profile.handle);
  const trustAnchor = profile.trustScore ?? 55;
  const followersCount = profile.followersCount ?? seededInteger(seed * 11, 12000, 175000) + trustAnchor * 90;
  const followingCount = profile.followingCount ?? seededInteger(seed * 7, 120, 2400);
  const tweetsCount = profile.tweetsCount ?? seededInteger(seed * 13, 700, 18000);
  const verifiedFollowersCount =
    profile.verifiedFollowersCount ??
    Math.min(followersCount, Math.round(followersCount * (0.03 + (trustAnchor / 100) * 0.05)));

  const nextProfile: KolProfileDetail = {
    ...profile,
    followersCount,
    followingCount,
    tweetsCount,
    verifiedFollowersCount,
    reasoningPoints:
      profile.reasoningPoints.length > 0
        ? profile.reasoningPoints
        : [
            {
              id: `${profile.slug}-synthetic-reasoning-1`,
              sortOrder: 0,
              content:
                "Placeholder reasoning generated from current registry metadata while richer profile research is still syncing.",
            },
            {
              id: `${profile.slug}-synthetic-reasoning-2`,
              sortOrder: 1,
              content:
                "Synthetic fallback is enabled for layout continuity; replace this text with manual or X-synced intelligence when available.",
            },
          ],
    recentSignals:
      profile.recentSignals.length > 0
        ? profile.recentSignals
        : [
            {
              id: `${profile.slug}-synthetic-signal-1`,
              signalCode: "PLACEHOLDER-01",
              title: `${profile.displayName} profile sync pending`,
              statusLabel: "Placeholder",
              description:
                "Synthetic placeholder signal generated for UI continuity until real recent-signal history is stored.",
              impactLabel: "Low confidence",
              publishedAt: null,
            },
            {
              id: `${profile.slug}-synthetic-signal-2`,
              signalCode: "PLACEHOLDER-02",
              title: "Research sync still pending",
              statusLabel: "Placeholder",
              description:
                "This placeholder entry exists only because deterministic synthetic fill is enabled for missing intelligence data.",
              impactLabel: "Low confidence",
              publishedAt: null,
            },
          ],
    sourceMeta: {
      dataSource: "synthetic_fallback",
      dataConfidence: "low",
      isPlaceholder: true,
      lastUpdatedAt: profile.sourceMeta.lastUpdatedAt,
    },
  };

  return {
    usedSynthetic: true,
    profile: nextProfile,
  };
}
