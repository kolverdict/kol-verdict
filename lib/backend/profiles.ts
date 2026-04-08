import { getCurrentSession } from "@/lib/backend/auth";
import { formatCompactNumber, formatRelativeTime } from "@/lib/backend/mappers";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type {
  ActivityView,
  AppProfile,
  Tone,
  UserAchievementView,
  UserProfileView,
} from "@/lib/types/domain";
import type {
  KolCommentRow,
  KolRow,
  KolVoteRow,
  KolWatchlistRow,
  ProfileRow,
} from "@/lib/types/db";

type JoinedKol = Pick<KolRow, "slug" | "x_username" | "display_name">;

type JoinedVoteRow = KolVoteRow & {
  kols?: JoinedKol | JoinedKol[] | null;
};

type JoinedCommentRow = KolCommentRow & {
  kols?: JoinedKol | JoinedKol[] | null;
};

type JoinedWatchlistRow = KolWatchlistRow & {
  kols?: JoinedKol | JoinedKol[] | null;
};

type TimelineEntry = {
  id: string;
  timestamp: string;
  activity: ActivityView;
  artifact: UserProfileView["recentArtifacts"][number];
};

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) return [] as T[];
  return Array.isArray(value) ? value : [value];
}

function mapProfileRow(row: ProfileRow): AppProfile {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    walletChain: row.wallet_chain,
    username: row.username,
    avatarUrl: row.avatar_url,
    reputationScore: Number(row.reputation_score),
    influenceWeight: Number(row.influence_weight),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shortWallet(address: string | null | undefined) {
  if (!address) return "Anonymous";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function displayNameFromProfile(profile: AppProfile) {
  const base = profile.username?.trim() || shortWallet(profile.walletAddress);
  return base.toUpperCase();
}

function roleFromInfluence(influenceWeight: number) {
  if (influenceWeight >= 85) return "Oracle";
  if (influenceWeight >= 65) return "Sentinel";
  if (influenceWeight >= 45) return "Analyst";
  return "Observer";
}

function levelFromReputation(reputationPoints: number) {
  return Math.max(1, Math.round(reputationPoints / 40));
}

function toneFromTag(tag: string | null | undefined): Tone {
  const normalized = tag?.toLowerCase().trim() ?? "";
  if (!normalized) return "neutral";
  if (normalized.includes("rug") || normalized.includes("scam") || normalized.includes("shill")) return "tertiary";
  if (normalized.includes("good") || normalized.includes("alpha")) return "primary";
  return "secondary";
}

function toneFromVote(direction: JoinedVoteRow["direction"]): Tone {
  return direction === "love" ? "primary" : "tertiary";
}

function normalizeVerdictTag(tag: string | null | undefined) {
  const normalized = tag?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase() === "trust") return "Endorse";
  if (normalized.toLowerCase() === "scam") return "Reject";
  return normalized;
}

function getKolMeta(row: { kols?: JoinedKol | JoinedKol[] | null }) {
  const kol = toArray(row.kols)[0];
  const xUsername = kol?.x_username?.trim() ?? "unknown";
  return {
    slug: kol?.slug ?? "",
    handle: `@${xUsername}`,
    displayName: kol?.display_name?.trim() || `@${xUsername}`,
  };
}

function truncate(value: string, maxLength = 96) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildTimelineEntries(votes: JoinedVoteRow[], comments: JoinedCommentRow[], watchlists: JoinedWatchlistRow[]) {
  const voteEntries: TimelineEntry[] = votes.map((vote) => {
    const kol = getKolMeta(vote);
    const title = vote.direction === "love" ? `Endorsed ${kol.handle}` : `Rejected ${kol.handle}`;
    const verdictTag = normalizeVerdictTag(vote.tag);
    const detail = verdictTag ? `${verdictTag} verdict recorded on ${kol.displayName}.` : `Verdict recorded on ${kol.displayName}.`;
    const tone = toneFromVote(vote.direction);

    return {
      id: `vote-${vote.id}`,
      timestamp: vote.updated_at ?? vote.created_at,
      activity: {
        id: `vote-activity-${vote.id}`,
        title,
        detail,
        time: formatRelativeTime(vote.updated_at ?? vote.created_at),
        icon: vote.direction === "love" ? "swipe_right" : "swipe_left",
        tone,
      },
      artifact: {
        title: `Submitted verdict on ${kol.handle}`,
        body: `Action: ${vote.direction === "love" ? "Endorsed" : "Rejected"}${verdictTag ? ` • Tag: ${verdictTag}` : ""}`,
        time: formatRelativeTime(vote.updated_at ?? vote.created_at),
        icon: "how_to_vote",
        tone,
      },
    };
  });

  const commentEntries: TimelineEntry[] = comments.map((comment) => {
    const kol = getKolMeta(comment);
    const tone = toneFromTag(comment.tag);
    const time = formatRelativeTime(comment.created_at);

    return {
      id: `comment-${comment.id}`,
      timestamp: comment.created_at,
      activity: {
        id: `comment-activity-${comment.id}`,
        title: `Commented on ${kol.handle}`,
        detail: truncate(comment.body),
        time,
        icon: comment.payment_status === "confirmed" ? "fact_check" : "chat_bubble",
        tone,
      },
      artifact: {
        title: `Commented on ${kol.handle}`,
        body: truncate(comment.body, 84),
        time,
        icon: comment.payment_status === "confirmed" ? "fact_check" : "chat_bubble",
        tone,
      },
    };
  });

  const watchEntries: TimelineEntry[] = watchlists.map((watchlist) => {
    const kol = getKolMeta(watchlist);
    const time = formatRelativeTime(watchlist.created_at);

    return {
      id: `watch-${watchlist.id}`,
      timestamp: watchlist.created_at,
      activity: {
        id: `watch-activity-${watchlist.id}`,
        title: `Watchlisted ${kol.handle}`,
        detail: `Added ${kol.displayName} to your monitored KOL set.`,
        time,
        icon: "visibility",
        tone: "secondary",
      },
      artifact: {
        title: `Watchlisted ${kol.handle}`,
        body: `Added ${kol.displayName} to your personal watchlist.`,
        time,
        icon: "visibility",
        tone: "secondary",
      },
    };
  });

  return [...commentEntries, ...voteEntries, ...watchEntries].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function buildTrustClusters(votes: JoinedVoteRow[], comments: JoinedCommentRow[]) {
  const tagCounts = new Map<string, number>();

  for (const tag of [...votes.map((vote) => vote.tag), ...comments.map((comment) => comment.tag)]) {
    const normalized = tag?.trim();
    if (!normalized) {
      continue;
    }

    tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
  }

  const entries = [...tagCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const tones: Tone[] = ["primary", "secondary", "tertiary"];

  return entries.map(([label, value], index) => ({
    label,
    value: `${Math.max(1, Math.round((value / Math.max(total, 1)) * 100))}%`,
    tone: tones[index] ?? "neutral",
  }));
}

function buildAchievements(
  reputationPoints: number,
  totalVotes: number,
  totalComments: number,
  confirmedComments: number,
  watchlistCount: number,
): UserAchievementView[] {
  const achievements: UserAchievementView[] = [];
  const role = roleFromInfluence(reputationPoints >= 1 ? clamp(reputationPoints / 20, 0, 100) : 0);

  if (reputationPoints >= 1000) {
    achievements.push({ label: `${role} Tier`, icon: "verified", tone: "secondary" });
  }

  if (totalVotes > 0) {
    achievements.push({
      label: totalVotes >= 25 ? "High Conviction" : "Active Evaluator",
      icon: "how_to_vote",
      tone: "primary",
    });
  }

  if (confirmedComments > 0) {
    achievements.push({
      label: confirmedComments >= 5 ? "Claim Verifier" : "Proof Posted",
      icon: "fact_check",
      tone: "secondary",
    });
  } else if (totalComments > 0) {
    achievements.push({ label: "Commented", icon: "chat_bubble", tone: "neutral" });
  }

  if (watchlistCount > 0 && achievements.length < 3) {
    achievements.push({ label: "Signal Watcher", icon: "visibility", tone: "neutral" });
  }

  return achievements.slice(0, 3);
}

export async function getCurrentUserProfileView() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const client = createInsForgeServerClient();

  const [profileResponse, votesResponse, commentsResponse, watchlistsResponse, rankingsResponse] = await Promise.all([
    client.database.from("profiles").select("*").eq("id", session.profileId).maybeSingle(),
    client.database
      .from("kol_votes")
      .select("id, profile_id, kol_id, direction, tag, created_at, updated_at, kols(slug, x_username, display_name)")
      .eq("profile_id", session.profileId)
      .order("updated_at", { ascending: false })
      .limit(24),
    client.database
      .from("kol_comments")
      .select("id, profile_id, kol_id, body, tag, fee_amount, payment_status, moderation_status, created_at, updated_at, kols(slug, x_username, display_name)")
      .eq("profile_id", session.profileId)
      .order("created_at", { ascending: false })
      .limit(24),
    client.database
      .from("kol_watchlists")
      .select("id, profile_id, kol_id, created_at, kols(slug, x_username, display_name)")
      .eq("profile_id", session.profileId)
      .order("created_at", { ascending: false })
      .limit(24),
    client.database.from("profiles").select("id, reputation_score").order("reputation_score", { ascending: false }).limit(250),
  ]);

  if (profileResponse.error) {
    throw profileResponse.error;
  }

  if (!profileResponse.data) {
    return null;
  }

  if (votesResponse.error) {
    throw votesResponse.error;
  }

  if (commentsResponse.error) {
    throw commentsResponse.error;
  }

  if (watchlistsResponse.error) {
    throw watchlistsResponse.error;
  }

  if (rankingsResponse.error) {
    throw rankingsResponse.error;
  }

  const profile = mapProfileRow(profileResponse.data as ProfileRow);
  const votes = (votesResponse.data ?? []) as JoinedVoteRow[];
  const comments = (commentsResponse.data ?? []) as JoinedCommentRow[];
  const watchlists = (watchlistsResponse.data ?? []) as JoinedWatchlistRow[];
  const rankings = (rankingsResponse.data ?? []) as Array<Pick<ProfileRow, "id" | "reputation_score">>;

  const avatar = profile.avatarUrl ?? session.avatarUrl ?? null;
  const displayName = displayNameFromProfile(profile);
  const reputationPoints = Math.max(0, Math.round(profile.reputationScore));
  const influenceWeight = Number(profile.influenceWeight.toFixed(1));
  const role = roleFromInfluence(influenceWeight);
  const level = levelFromReputation(reputationPoints);
  const timeline = buildTimelineEntries(votes, comments, watchlists);
  const confirmedComments = comments.filter((comment) => comment.payment_status === "confirmed").length;
  const rankIndex = rankings.findIndex((entry) => entry.id === profile.id);
  const rankLabel = rankIndex === -1 ? "Rank Untracked" : `Rank #${rankIndex + 1}`;
  const trustClusters = buildTrustClusters(votes, comments);
  const achievements = buildAchievements(
    reputationPoints,
    votes.length,
    comments.length,
    confirmedComments,
    watchlists.length,
  );

  return {
    profile,
    displayName,
    heroHandle: `Level ${level} ${role}`,
    heroTag: `Influencer Level: ${role}`,
    heroBio: `Solana profile ${shortWallet(profile.walletAddress)} has submitted ${votes.length} verdict${votes.length === 1 ? "" : "s"}, published ${comments.length} claims, and monitors ${watchlists.length} KOL${watchlists.length === 1 ? "" : "s"} across the registry.`,
    heroAvatar: avatar,
    portraitImage: avatar,
    clusterImage: avatar,
    reputationPoints,
    reputationDelta: `Updated ${formatRelativeTime(profile.updatedAt)}`,
    rankLabel,
    influenceWeightLabel: `${influenceWeight.toFixed(1)}NW`,
    mobileStats: [
      {
        label: "Total Verdicts",
        value: formatCompactNumber(votes.length),
        icon: "how_to_vote",
        tone: "primary",
        span: "col-span-1",
      },
      {
        label: "Published Claims",
        value: formatCompactNumber(comments.length),
        icon: "fact_check",
        tone: "secondary",
        span: "col-span-1",
      },
      {
        label: "Influence Weight",
        value: influenceWeight.toFixed(1),
        icon: "weight",
        tone: "tertiary",
        span: "col-span-2",
        delta: rankLabel,
      },
    ],
    recentActivity: timeline.slice(0, 4).map((entry) => entry.activity),
    trustClusters,
    achievements,
    recentArtifacts: timeline.slice(0, 4).map((entry) => entry.artifact),
  } satisfies UserProfileView;
}
