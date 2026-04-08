import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { AppError } from "@/lib/backend/errors";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { readAppSession } from "@/lib/insforge/session";
import type { AppProfile, AppSession, WalletProfileInput } from "@/lib/types/domain";
import type { ProfileRow } from "@/lib/types/db";

export async function getCurrentSession() {
  return readAppSession();
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    throw new AppError("unauthorized", "Connect your wallet to continue.", 401);
  }

  return session;
}

export function verifySolanaWalletSignature(walletAddress: string, message: string, signature: string) {
  let publicKey: PublicKey;
  let decodedSignature: Uint8Array;

  try {
    publicKey = new PublicKey(walletAddress);
    decodedSignature = bs58.decode(signature);
  } catch {
    throw new AppError("invalid_wallet_signature", "Invalid wallet signature payload.", 400);
  }

  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    decodedSignature,
    publicKey.toBytes(),
  );

  if (!verified) {
    throw new AppError("wallet_signature_failed", "Wallet signature verification failed.", 401);
  }
}

function mapProfileRow(row: ProfileRow): AppProfile {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    walletChain: row.wallet_chain,
    username: row.username,
    avatarUrl: row.avatar_url,
    reputationScore: row.reputation_score,
    influenceWeight: row.influence_weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertProfileFromWallet(input: WalletProfileInput): Promise<AppProfile> {
  const client = createInsForgeServerClient();
  const walletAddress = input.walletAddress.toLowerCase();
  const existing = await client.database
    .from("profiles")
    .select("*")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing.error) {
    throw new AppError("profile_lookup_failed", existing.error.message, 500);
  }

  if (existing.data) {
    const updated = await client.database
      .from("profiles")
      .update({
        wallet_chain: input.walletChain,
        username: input.username ?? existing.data.username,
        avatar_url: input.avatarUrl ?? existing.data.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (updated.error || !updated.data) {
      throw new AppError(
        "profile_update_failed",
        updated.error?.message ?? "Unable to update profile.",
        500,
      );
    }

    return mapProfileRow(updated.data as ProfileRow);
  }

  const inserted = await client.database
    .from("profiles")
    .insert([
      {
        wallet_address: walletAddress,
        wallet_chain: input.walletChain,
        username: input.username ?? null,
        avatar_url: input.avatarUrl ?? null,
        reputation_score: 0,
        influence_weight: 0,
      },
    ])
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    throw new AppError(
      "profile_create_failed",
      inserted.error?.message ?? "Unable to create profile.",
      500,
    );
  }

  return mapProfileRow(inserted.data as ProfileRow);
}

export function createSessionPayload(profile: AppProfile): Omit<AppSession, "issuedAt" | "expiresAt"> {
  if (!profile.walletAddress || !profile.walletChain) {
    throw new AppError("invalid_profile_session", "Profile is missing wallet information.", 500);
  }

  return {
    profileId: profile.id,
    walletAddress: profile.walletAddress,
    walletChain: profile.walletChain,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
  };
}
