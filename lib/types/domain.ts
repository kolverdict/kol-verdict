import type {
  CommentEvidenceRow,
  EvidenceType,
  PaymentStatus,
  VoteDirection,
  WalletChain,
} from "@/lib/types/db";

export type Tone = "primary" | "secondary" | "tertiary" | "neutral";
export type LeaderboardTab = "trusted" | "hated" | "trending";

export interface AppSession {
  profileId: string;
  walletAddress: string;
  walletChain: WalletChain;
  username: string | null;
  avatarUrl: string | null;
  issuedAt: string;
  expiresAt: string;
}

export interface AppProfile {
  id: string;
  walletAddress: string | null;
  walletChain: WalletChain | null;
  username: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  influenceWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatCardView {
  label: string;
  value: string;
  meta?: string;
  tone: Tone;
}

export interface HomeStatView {
  label: string;
  value: string;
  tone?: Tone;
}

export interface HomeCardView {
  slug: string;
  handle: string;
  role: string;
  reputation: number;
  badge: string;
  verification: string;
  image: string | null;
  subjectId: string;
  name: string;
  bio: string;
  monthlyChange: string;
  globalRank: string;
  stats: HomeStatView[];
}

export interface LeaderboardEntryView {
  slug: string;
  handle: string;
  displayName?: string;
  image: string | null;
  subtitle: string;
  trustScore: number;
  hateScore: number;
  trendingScore: number;
  bullishPercent: number;
  tier: string;
  sparkline: number[];
  verified?: boolean;
  flowLabel: string;
  trendLabel: string;
  trendTone: Tone;
  muted?: boolean;
}

export interface LeaderboardSnapshot {
  tab: LeaderboardTab;
  stats: StatCardView[];
  entries: LeaderboardEntryView[];
  total: number;
}

export interface EvidenceView {
  id: string;
  type: EvidenceType;
  url: string;
  storageKey: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CommentActionView {
  icon: string;
  label: string;
  tone: "secondary" | "muted";
  href?: string;
}

export interface CommentView {
  id: string;
  author: string;
  profileId: string;
  time: string;
  verdict: string;
  tone: Tone;
  body: string;
  avatar: string | null;
  premium?: boolean;
  grayscale?: boolean;
  paymentStatus: PaymentStatus;
  tag: string | null;
  evidence: EvidenceView[];
  actions: CommentActionView[];
}

export interface ProofPointView {
  id: string;
  title: string;
  summary: string;
  time: string;
  action: string;
  badge: string;
  tone: Tone;
  icon: string;
}

export interface ActivityView {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: string;
  tone: Tone;
}

export interface EndorserView {
  name: string;
  score: string;
  avatar: string | null;
  tone: "primary" | "secondary" | "neutral";
}

export interface NetworkView {
  name: string;
  meta: string;
  icon: string;
  tone: "primary" | "secondary";
}

export interface KolSummaryView {
  id: string;
  slug: string;
  xUsername: string;
  displayName: string;
  handle: string;
  role: string;
  avatarUrl: string | null;
  bio: string;
  score: number;
  positive: number;
  negative: number;
  verifiedLabel: string;
  accurateCalls: string;
  reputation: string;
  communityScore: string;
  communityMeta: string;
  networks: NetworkView[];
}

export interface KolProfileView {
  kol: KolSummaryView;
  summaryStats: Array<{
    label: string;
    value: string;
    icon: string;
    tone: Tone;
  }>;
  mobileHeatmapWords: Array<Array<{ label: string; className: string }>>;
  heatmap: number[][];
  comments: CommentView[];
  proofPoints: ProofPointView[];
  activity: ActivityView[];
  endorsers: EndorserView[];
}

export interface UserAchievementView {
  label: string;
  icon: string;
  tone: Tone;
}

export interface TrustClusterView {
  label: string;
  value: string;
  tone: Tone;
}

export interface UserProfileView {
  profile: AppProfile;
  displayName: string;
  heroHandle: string;
  heroTag: string;
  heroBio: string;
  heroAvatar: string | null;
  portraitImage: string | null;
  clusterImage: string | null;
  reputationPoints: number;
  reputationDelta: string;
  rankLabel: string;
  influenceWeightLabel: string;
  mobileStats: Array<{
    label: string;
    value: string;
    icon: string;
    tone: Tone;
    span: "col-span-1" | "col-span-2";
    delta?: string;
  }>;
  recentActivity: ActivityView[];
  trustClusters: TrustClusterView[];
  achievements: UserAchievementView[];
  recentArtifacts: Array<{
    title: string;
    body: string;
    time: string;
    icon: string;
    tone: Tone;
  }>;
}

export interface CreateKolInput {
  xUsername: string;
  walletAddress?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface CastKolVoteInput {
  kolSlug: string;
  direction: VoteDirection;
  tag?: string | null;
}

export interface CreateKolCommentInput {
  kolSlug: string;
  body: string;
  tag?: string | null;
  feeAmount?: string;
}

export interface AttachEvidenceInput {
  commentId: string;
  type: EvidenceType;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceUploadResult {
  url: string;
  storageKey: string | null;
}

export interface WalletProfileInput {
  walletAddress: string;
  walletChain: WalletChain;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface MutableCommentEvidence extends Omit<CommentEvidenceRow, "metadata_json"> {
  metadata_json: Record<string, unknown> | null;
}
