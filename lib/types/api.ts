import type {
  AppProfile,
  AppSession,
  CommentView,
  HomeCardView,
  KolProfileView,
  LeaderboardSnapshot,
  UserProfileView,
} from "@/lib/types/domain";
import type { EvidenceType, KolDataConfidence, KolDataSource, VoteDirection } from "@/lib/types/db";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface WalletChallengeRequest {
  walletAddress: string;
}

export interface WalletChallengeResponse {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface WalletVerifyRequest {
  walletAddress: string;
  message: string;
  signature: string;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface WalletVerifyResponse {
  session: AppSession;
  profile: AppProfile;
}

export interface MeResponse {
  session: AppSession | null;
  profile: AppProfile | null;
  userProfile: UserProfileView | null;
}

export interface CreateKolRequest {
  xUsername: string;
  walletAddress?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface CreateKolResponse {
  slug: string;
  createdAt: string;
}

export interface LeaderboardResponse {
  snapshot: LeaderboardSnapshot;
}

export interface HomeResponse {
  cards: HomeCardView[];
}

export interface KolProfileResponse {
  profile: KolProfileView;
}

export interface KolSourceMeta {
  dataSource: KolDataSource;
  dataConfidence: KolDataConfidence;
  isPlaceholder: boolean;
  lastUpdatedAt: string | null;
}

export interface KolProfileDetail {
  id: string;
  slug: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
  trustScore: number | null;
  followersCount: number | null;
  followingCount: number | null;
  tweetsCount: number | null;
  verifiedFollowersCount: number | null;
  globalRank: number | null;
  activityLabel: string | null;
  verdictLabel: string | null;
  verdictSummary: string | null;
  riskLevel: string | null;
  reasoningPoints: Array<{
    id: string;
    content: string;
    sortOrder: number;
  }>;
  recentSignals: Array<{
    id: string;
    signalCode: string | null;
    title: string;
    statusLabel: string | null;
    description: string | null;
    impactLabel: string | null;
    publishedAt: string | null;
  }>;
  sourceMeta: KolSourceMeta;
}

export interface KolProfileDetailResponse {
  profile: KolProfileDetail;
}

export interface KolSearchMatch {
  slug: string;
}

export interface KolSearchResponse {
  match: KolSearchMatch | null;
}

export interface VoteRequest {
  direction: VoteDirection;
  tag?: string | null;
}

export interface VoteResponse {
  success: true;
  score: number;
}

export interface CreateCommentRequest {
  body: string;
  tag?: string | null;
  feeAmount?: string;
}

export interface CreateCommentResponse {
  comment: CommentView;
}

export interface AttachEvidenceResponse {
  evidenceId: string;
  url: string;
  storageKey: string | null;
  type: EvidenceType;
}
