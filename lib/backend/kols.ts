import { AppError } from "@/lib/backend/errors";
import { getLeaderboardSnapshot } from "@/lib/backend/leaderboard";
import { createSlug, formatCompactNumber, formatRelativeTime, normalizeHandle } from "@/lib/backend/mappers";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type {
  ActivityView,
  CastKolVoteInput,
  CommentActionView,
  CommentView,
  CreateKolInput,
  EndorserView,
  HomeCardView,
  LeaderboardEntryView,
  KolProfileView,
  NetworkView,
  ProofPointView,
  Tone,
} from "@/lib/types/domain";
import type {
  CommentEvidenceRow,
  EvidenceType,
  KolCommentRow,
  KolMetricsCacheRow,
  KolRow,
  PaymentStatus,
  ProfileRow,
  VoteDirection,
} from "@/lib/types/db";

type JoinedKolCommentRow = KolCommentRow & {
  profiles?:
    | Pick<ProfileRow, "username" | "avatar_url" | "wallet_address">
    | Array<Pick<ProfileRow, "username" | "avatar_url" | "wallet_address">>
    | null;
  comment_evidence?: CommentEvidenceRow[] | null;
};

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) return [] as T[];
  return Array.isArray(value) ? value : [value];
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return toArray(value)[0];
}

function toneFromTag(tag: string | null, paymentStatus: PaymentStatus): Tone {
  const label = tag?.toLowerCase() ?? "";

  if (["scam", "rug", "risk", "bearish", "flagged", "warning"].some((keyword) => label.includes(keyword))) {
    return "tertiary";
  }

  if (["trust", "good", "alpha", "bull", "verified", "legit"].some((keyword) => label.includes(keyword))) {
    return paymentStatus === "confirmed" ? "primary" : "secondary";
  }

  if (paymentStatus === "confirmed") {
    return "secondary";
  }

  return "neutral";
}

function verdictFromTag(tag: string | null, tone: Tone) {
  if (tag?.trim()) {
    return tag.trim();
  }

  if (tone === "primary") return "Trustworthy";
  if (tone === "secondary") return "Bullish";
  if (tone === "tertiary") return "Risk";
  return "Neutral";
}

function evidenceIcon(type?: EvidenceType) {
  if (type === "tweet") return "link";
  if (type === "tx") return "database";
  if (type === "image") return "image";
  return "attachment";
}

function evidenceLabel(evidence: CommentEvidenceRow) {
  const metadataLabel =
    evidence.metadata_json && typeof evidence.metadata_json === "object" && "label" in evidence.metadata_json
      ? evidence.metadata_json.label
      : null;

  if (typeof metadataLabel === "string" && metadataLabel.trim()) {
    return metadataLabel.trim();
  }

  if (evidence.type === "tweet") return "View Tweet";
  if (evidence.type === "tx") return "TX Hash";
  if (evidence.type === "image") return "View Proof";
  return "Open Link";
}

function shortWallet(address: string | null | undefined) {
  if (!address) return "Anonymous Oracle";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function commentActionsFromEvidence(evidence: CommentEvidenceRow[]): CommentActionView[] {
  if (evidence.length === 0) {
    return [{ icon: "attachment", label: "Evidence", tone: "muted" }];
  }

  return evidence.slice(0, 2).map((entry) => ({
    icon: evidenceIcon(entry.type),
    label: evidenceLabel(entry),
    tone: "secondary",
    href: entry.url,
  }));
}

function buildRealCommentView(comment: JoinedKolCommentRow): CommentView {
  const profile = toArray(comment.profiles)[0];
  const evidence = toArray(comment.comment_evidence);
  const tone = toneFromTag(comment.tag, comment.payment_status);

  return {
    id: comment.id,
    author: profile?.username?.trim() || shortWallet(profile?.wallet_address),
    profileId: comment.profile_id,
    time: formatRelativeTime(comment.created_at),
    verdict: verdictFromTag(comment.tag, tone),
    tone,
    body: comment.body,
    avatar: profile?.avatar_url ?? null,
    premium: comment.payment_status === "confirmed",
    grayscale: comment.payment_status !== "confirmed",
    paymentStatus: comment.payment_status,
    tag: comment.tag,
    evidence: evidence.map((entry) => ({
      id: entry.id,
      type: entry.type,
      url: entry.url,
      storageKey: entry.storage_key,
      metadata: entry.metadata_json,
    })),
    actions: commentActionsFromEvidence(evidence),
  };
}

function buildRealNetworks(row: KolRow): NetworkView[] {
  return [
    {
      name: "X / Twitter",
      meta: `@${row.x_username}`,
      icon: "hub",
      tone: "primary",
    },
    {
      name: "Registry Status",
      meta: row.wallet_address ? "Wallet Linked" : "Profile Only",
      icon: "database",
      tone: "secondary",
    },
  ];
}

function buildSummaryStats(loveCount: number, hateCount: number, totalComments: number) {
  return [
    { label: "Total Verdicts", value: formatCompactNumber(loveCount + hateCount), icon: "poll", tone: "secondary" as const },
    { label: "Claims Backed", value: `${Math.round((loveCount / Math.max(1, loveCount + hateCount)) * 100)}%`, icon: "fact_check", tone: "primary" as const },
    { label: "Total Comments", value: formatCompactNumber(totalComments), icon: "chat", tone: "neutral" as const },
  ];
}

function buildHeatmap(slug: string, score: number, positive: number) {
  const rows = 6;
  const cols = 18;
  const seed = slug.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = Math.max(1, Math.min(5, Math.round(score / 20)));
  const sentimentBias = Math.max(0, Math.min(4, Math.round(positive / 25)));

  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => {
      const wave = ((seed + rowIndex * 7 + colIndex * 11) % 5) + 1;
      return Math.max(1, Math.min(5, Math.round((base + sentimentBias + wave) / 2)));
    }),
  );
}

function buildHeatmapWords(score: number, positive: number, negative: number) {
  return [
    [
      {
        label: score >= 80 ? "HIGH TRUST" : score >= 60 ? "EMERGING EDGE" : "RISK WATCH",
        className: "text-[2rem] font-black tracking-[-0.08em] text-primary",
      },
    ],
    [
      { label: "TECHNICAL", className: "text-[0.92rem] font-bold uppercase tracking-[0.02em] text-secondary" },
      {
        label: positive >= 70 ? "LEGIT" : negative >= 45 ? "DIVIDED" : "ACTIVE",
        className: "text-[1.12rem] font-extrabold tracking-[-0.05em] text-white",
      },
      { label: "SHILL?", className: "text-[0.8rem] font-bold uppercase text-on-surface-variant/40" },
    ],
    [
      {
        label: score >= 85 ? "TOP TIER" : score >= 70 ? "PROVEN" : "VOLATILE",
        className: "text-[1.75rem] font-black tracking-[-0.08em] text-primary-dim",
      },
      {
        label: negative >= 45 ? "CAUTION" : "RELIABLE",
        className: "text-[0.9rem] font-medium uppercase text-on-surface-variant/55",
      },
    ],
    [
      {
        label: positive >= 60 ? "BULLISH" : negative >= 50 ? "RISK HEAVY" : "MIXED",
        className: "text-[2.75rem] font-black tracking-[-0.08em] text-primary/85",
      },
    ],
    [
      {
        label: negative >= 40 ? "SCAM ALLEGATIONS" : "COMMUNITY VERIFIED",
        className: "text-[0.9rem] font-bold uppercase tracking-[0.01em] text-tertiary/28",
      },
    ],
  ];
}

function proofIconFromComment(comment: CommentView) {
  if (comment.evidence[0]) {
    return evidenceIcon(comment.evidence[0].type);
  }

  if (comment.tone === "tertiary") return "warning";
  if (comment.tone === "primary") return "check_circle";
  return "forum";
}

function buildProofPoints(comments: CommentView[]): ProofPointView[] {
  const sources = (comments.filter((comment) => comment.evidence.length > 0).length > 0
    ? comments.filter((comment) => comment.evidence.length > 0)
    : comments
  ).slice(0, 2);

  return sources.map((comment) => ({
    id: comment.id,
    title: comment.tag ? `${comment.tag}: Community Claim` : "Community Claim Logged",
    summary: comment.body,
    time: comment.time,
    action: comment.actions[0]?.label ?? "Open Evidence",
    badge: comment.evidence.length > 0 ? "Evidence Verified" : "Community Logged",
    tone: comment.tone,
    icon: proofIconFromComment(comment),
  }));
}

function buildActivity(comments: CommentView[], positive: number): ActivityView[] {
  if (comments.length === 0) {
    return [
      {
        id: "activity-bootstrap",
        title: "Consensus initialized",
        detail: "The KOL registry is tracking live reputation metrics for this profile.",
        time: "just now",
        icon: "monitoring",
        tone: positive >= 70 ? "primary" : "secondary",
      },
    ];
  }

  return comments.slice(0, 3).map((comment) => ({
    id: `activity-${comment.id}`,
    title: comment.evidence.length > 0 ? "Evidence attached to claim" : "New community claim logged",
    detail: comment.body,
    time: comment.time,
    icon: comment.evidence.length > 0 ? "fact_check" : comment.tone === "tertiary" ? "warning" : "forum",
    tone: comment.tone,
  }));
}

function buildEndorsers(comments: CommentView[]): EndorserView[] {
  const grouped = new Map<
    string,
    { name: string; avatar: string | null; count: number; primary: number; tertiary: number }
  >();

  comments.forEach((comment) => {
    const current = grouped.get(comment.profileId) ?? {
      name: comment.author,
      avatar: comment.avatar,
      count: 0,
      primary: 0,
      tertiary: 0,
    };

    current.count += 1;
    if (comment.tone === "primary") current.primary += 1;
    if (comment.tone === "tertiary") current.tertiary += 1;
    grouped.set(comment.profileId, current);
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((entry) => ({
      name: entry.name,
      score: `${entry.count} community ${entry.count === 1 ? "claim" : "claims"}`,
      avatar: entry.avatar,
      tone: entry.primary >= entry.tertiary ? (entry.primary > 0 ? "primary" : "neutral") : "secondary",
    }));
}

function reputationGrade(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  return "C";
}

function buildKolBio(row: KolRow) {
  return row.bio?.trim() || `${row.wallet_address ? "Wallet-linked" : "Registry-tracked"} profile under live community review.`;
}

function buildKolRole(row: KolRow, score: number, positive: number, signalCount: number) {
  if (row.wallet_address && score >= 80) return "Wallet-Linked Oracle";
  if (positive >= 70) return "Community Verified Analyst";
  if (signalCount > 0) return "Registry Tracked Analyst";
  return "Profile Under Review";
}

function buildVerifiedLabel(row: KolRow, signalCount: number) {
  if (row.wallet_address && signalCount >= 3) return "Community Verified";
  if (row.wallet_address) return "Wallet Linked";
  if (signalCount >= 3) return "Registry Verified";
  return "Registry Tracked";
}

function buildHomeRole(entry: Pick<LeaderboardEntryView, "trustScore" | "trendingScore" | "verified">) {
  if (entry.verified && entry.trustScore >= 900) return "Oracle Verified Alpha";
  if (entry.trendingScore >= 60) return "Quantitative Analyst";
  return "Registry Analyst";
}

function buildHomeBadge(index: number, trendingScore: number) {
  if (index === 0) return "Trending Now";
  return trendingScore >= 60 ? "Trending Signal" : `Ranking #${index + 1}`;
}

function buildHomeVerification(entry: Pick<LeaderboardEntryView, "trustScore" | "verified">) {
  if (entry.verified && entry.trustScore >= 900) return "Oracle Verified Alpha";
  if (entry.verified) return "Verified Oracle";
  return "Registry Tracked";
}

function mapHomeCard(entry: LeaderboardEntryView, index: number): HomeCardView {
  return {
    slug: entry.slug,
    handle: entry.handle,
    role: buildHomeRole(entry),
    reputation: Math.round(entry.trustScore / 10),
    badge: buildHomeBadge(index, entry.trendingScore),
    verification: buildHomeVerification(entry),
    image: entry.image,
    subjectId: `0x${entry.slug.slice(0, 3)}...${entry.slug.slice(-3)}`,
    name: entry.displayName ?? entry.handle.replace("@", ""),
    bio: entry.subtitle,
    monthlyChange: entry.trendLabel,
    globalRank: `Global Rank #${index + 1}`,
    stats: [
      { label: "Total Mentions", value: entry.flowLabel.replace(" SIGNALS", "") },
      { label: "Verdict Score", value: `${entry.trustScore}`, tone: "primary" },
      { label: "Consensus", value: `${entry.bullishPercent}% Bullish` },
    ],
  };
}

export async function getHomeCards() {
  const snapshot = await getLeaderboardSnapshot("trending");
  return snapshot.entries.slice(0, 500).map(mapHomeCard);
}

export async function createKol(input: CreateKolInput, profileId: string) {
  const xUsername = normalizeHandle(input.xUsername);
  const slug = createSlug(xUsername);

  const client = createInsForgeServerClient();
  const existing = await client.database.from("kols").select("id").eq("slug", slug).maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    throw new AppError("kol_exists", "That KOL is already registered.", 409);
  }

  const inserted = await client.database
    .from("kols")
    .insert([
      {
        slug,
        x_username: xUsername,
        display_name: input.displayName?.trim() || xUsername,
        wallet_address: input.walletAddress?.trim() || null,
        avatar_url: input.avatarUrl?.trim() || null,
        bio: null,
        initial_trust_score: 50,
        created_by_profile_id: profileId,
        status: "active",
      },
    ])
    .select("id, slug, created_at")
    .single();

  if (inserted.error || !inserted.data) {
    throw new AppError(
      "kol_create_failed",
      inserted.error?.message ?? "Unable to create KOL.",
      500,
    );
  }

  const metricsUpsert = await client.database.from("kol_metrics_cache").upsert([
    {
      kol_id: inserted.data.id,
      love_count: 0,
      hate_count: 0,
      total_comments: 0,
      trust_score: 50,
      controversy_score: 0,
      trending_score: 0,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (metricsUpsert.error) {
    throw new AppError(
      "kol_metrics_init_failed",
      metricsUpsert.error.message,
      500,
    );
  }

  return {
    slug: inserted.data.slug,
    createdAt: inserted.data.created_at,
  };
}

export async function getKolProfile(slug: string): Promise<KolProfileView> {
  const client = createInsForgeServerClient();
  const kolResponse = await client.database
    .from("kols")
    .select("id, slug, x_username, display_name, avatar_url, bio, initial_trust_score, kol_metrics_cache(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (kolResponse.error) {
    throw kolResponse.error;
  }

  if (!kolResponse.data) {
    throw new AppError("kol_not_found", "KOL not found.", 404);
  }

  const row = kolResponse.data as KolRow & { kol_metrics_cache?: KolMetricsCacheRow | KolMetricsCacheRow[] | null };
  const metrics = firstRelation(row.kol_metrics_cache);
  const score = Number(metrics?.trust_score ?? row.initial_trust_score ?? 0);
  const loveCount = metrics?.love_count ?? 0;
  const hateCount = metrics?.hate_count ?? 0;
  const totalComments = metrics?.total_comments ?? 0;
  const positive = Math.round((loveCount / Math.max(1, loveCount + hateCount)) * 100);
  const commentsResponse = await client.database
    .from("kol_comments")
    .select("id, profile_id, kol_id, body, tag, fee_amount, payment_status, moderation_status, created_at, updated_at, profiles(username, avatar_url, wallet_address), comment_evidence(*)")
    .eq("kol_id", row.id)
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false })
    .limit(12);

  if (commentsResponse.error) {
    throw commentsResponse.error;
  }

  const comments = ((commentsResponse.data as JoinedKolCommentRow[] | null) ?? []).map(buildRealCommentView);
  const proofPoints = buildProofPoints(comments);
  const activity = buildActivity(comments, positive);
  const endorsers = buildEndorsers(comments);
  const signalCount = loveCount + hateCount + comments.length;
  const bio = buildKolBio(row);

  return {
    kol: {
      id: row.id,
      slug: row.slug,
      xUsername: row.x_username,
      displayName: row.display_name ?? row.x_username,
      handle: `@${row.x_username}`,
      role: buildKolRole(row, score, positive, signalCount),
      avatarUrl: row.avatar_url ?? null,
      bio,
      score,
      positive,
      negative: 100 - positive,
      verifiedLabel: buildVerifiedLabel(row, signalCount),
      accurateCalls: `${positive}%`,
      reputation: reputationGrade(score),
      communityScore: `${positive}`,
      communityMeta: `Based on ${formatCompactNumber(signalCount)} community signals`,
      networks: buildRealNetworks(row),
    },
    summaryStats: buildSummaryStats(loveCount, hateCount, Math.max(totalComments, comments.length)),
    mobileHeatmapWords: buildHeatmapWords(score, positive, 100 - positive),
    heatmap: buildHeatmap(row.slug, score, positive),
    comments,
    proofPoints,
    activity,
    endorsers,
  };
}

export async function castKolVote(input: CastKolVoteInput, profileId: string) {
  const client = createInsForgeServerClient();
  const kolLookup = await client.database
    .from("kols")
    .select("id, initial_trust_score")
    .eq("slug", input.kolSlug)
    .maybeSingle();

  if (kolLookup.error) {
    throw kolLookup.error;
  }

  if (!kolLookup.data) {
    throw new AppError("kol_not_found", "KOL not found.", 404);
  }

  const upsert = await client.database
    .from("kol_votes")
    .upsert(
      [
        {
          profile_id: profileId,
          kol_id: kolLookup.data.id,
          direction: input.direction as VoteDirection,
          tag: input.tag ?? null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "profile_id,kol_id" },
    );

  if (upsert.error) {
    throw upsert.error;
  }

  await client.database.rpc("refresh_kol_metrics_cache", { p_kol_id: kolLookup.data.id });
  return { success: true as const, score: Number(kolLookup.data.initial_trust_score ?? 50) };
}
