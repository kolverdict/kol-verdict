export type WalletChain = "solana";

export type KolStatus = "active" | "hidden" | "flagged";
export type VoteDirection = "love" | "hate";
export type PaymentStatus = "pending" | "confirmed" | "failed";
export type ModerationStatus = "published" | "hidden" | "flagged";
export type EvidenceType = "tweet" | "tx" | "image" | "link";

export interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  wallet_address: string | null;
  wallet_chain: WalletChain | null;
  username: string | null;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  reputation_score: number;
  influence_weight: number;
  created_at: string;
  updated_at: string;
}

export interface KolRow {
  id: string;
  slug: string;
  x_username: string;
  display_name: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  bio: string | null;
  initial_trust_score: number;
  created_by_profile_id: string | null;
  status: KolStatus;
  created_at: string;
  updated_at: string;
}

export interface KolVoteRow {
  id: string;
  profile_id: string;
  kol_id: string;
  direction: VoteDirection;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface KolCommentRow {
  id: string;
  profile_id: string;
  kol_id: string;
  body: string;
  tag: string | null;
  fee_amount: string;
  payment_status: PaymentStatus;
  moderation_status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

export interface CommentEvidenceRow {
  id: string;
  comment_id: string;
  type: EvidenceType;
  url: string;
  storage_key: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface KolWatchlistRow {
  id: string;
  profile_id: string;
  kol_id: string;
  created_at: string;
}

export interface KolMetricsCacheRow {
  kol_id: string;
  love_count: number;
  hate_count: number;
  total_comments: number;
  trust_score: number;
  controversy_score: number;
  trending_score: number;
  updated_at: string;
}
