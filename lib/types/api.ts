import type {
  AppProfile,
  AppSession,
  CommentView,
  HomeCardView,
  KolProfileView,
  LeaderboardSnapshot,
  UserProfileView,
} from "@/lib/types/domain";
import type { EvidenceType, VoteDirection } from "@/lib/types/db";

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
