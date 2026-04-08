import { AppError } from "@/lib/backend/errors";
import { formatRelativeTime } from "@/lib/backend/mappers";
import { getCommentFeeAmount } from "@/lib/backend/payment";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { uploadEvidenceAsset } from "@/lib/insforge/storage";
import type { AttachEvidenceInput, CreateKolCommentInput, EvidenceUploadResult } from "@/lib/types/domain";
import type { PaymentStatus, ProfileRow } from "@/lib/types/db";

function toneFromTag(tag: string | null, paymentStatus: PaymentStatus) {
  const label = tag?.toLowerCase() ?? "";

  if (["scam", "rug", "risk", "bearish", "flagged", "warning"].some((keyword) => label.includes(keyword))) {
    return "tertiary" as const;
  }

  if (["trust", "good", "alpha", "bull", "verified", "legit"].some((keyword) => label.includes(keyword))) {
    return paymentStatus === "confirmed" ? ("primary" as const) : ("secondary" as const);
  }

  if (paymentStatus === "confirmed") {
    return "secondary" as const;
  }

  return "neutral" as const;
}

function verdictFromTag(tag: string | null, tone: ReturnType<typeof toneFromTag>) {
  if (tag?.trim()) {
    return tag.trim();
  }

  if (tone === "primary") return "Trustworthy";
  if (tone === "secondary") return "Bullish";
  if (tone === "tertiary") return "Risk";
  return "Neutral";
}

function shortWallet(address: string | null | undefined) {
  if (!address) return "Anonymous Oracle";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function createKolComment(input: CreateKolCommentInput, profileId: string) {
  const feeAmount = input.feeAmount ?? getCommentFeeAmount();

  const client = createInsForgeServerClient();
  const kol = await client.database.from("kols").select("id").eq("slug", input.kolSlug).maybeSingle();

  if (kol.error) {
    throw kol.error;
  }

  if (!kol.data) {
    throw new AppError("kol_not_found", "KOL not found.", 404);
  }

  const inserted = await client.database
    .from("kol_comments")
    .insert([
      {
        profile_id: profileId,
        kol_id: kol.data.id,
        body: input.body,
        tag: input.tag ?? null,
        fee_amount: feeAmount,
        payment_status: "pending",
        moderation_status: "published",
      },
    ])
    .select("id, body, tag, payment_status, created_at")
    .single();

  if (inserted.error || !inserted.data) {
    throw new AppError(
      "comment_create_failed",
      inserted.error?.message ?? "Unable to create comment.",
      500,
    );
  }

  const authorResponse = await client.database
    .from("profiles")
    .select("username, avatar_url, wallet_address")
    .eq("id", profileId)
    .maybeSingle();

  if (authorResponse.error) {
    throw new AppError("comment_author_lookup_failed", authorResponse.error.message, 500);
  }

  await client.database.rpc("refresh_kol_metrics_cache", { p_kol_id: kol.data.id });

  const author = authorResponse.data as Pick<ProfileRow, "username" | "avatar_url" | "wallet_address"> | null;
  const tone = toneFromTag(inserted.data.tag, inserted.data.payment_status);

  return {
    comment: {
      id: inserted.data.id,
      author: author?.username?.trim() || shortWallet(author?.wallet_address),
      profileId,
      time: formatRelativeTime(inserted.data.created_at),
      verdict: verdictFromTag(inserted.data.tag, tone),
      tone,
      body: inserted.data.body,
      avatar: author?.avatar_url ?? null,
      paymentStatus: inserted.data.payment_status,
      tag: inserted.data.tag,
      evidence: [],
      actions: [{ icon: "attachment", label: "Evidence", tone: "muted" as const }],
    },
  };
}

export async function attachEvidenceToComment(
  input: AttachEvidenceInput & { file?: Blob | null; filename?: string },
): Promise<EvidenceUploadResult & { evidenceId: string; type: AttachEvidenceInput["type"] }> {
  let uploaded: EvidenceUploadResult;

  if (input.file) {
    uploaded = await uploadEvidenceAsset(input.file, input.filename ?? "evidence");
  } else if (input.url) {
    uploaded = {
      url: input.url,
      storageKey: null,
    };
  } else {
    throw new AppError("evidence_missing", "Evidence upload requires a file or URL.", 400);
  }

  const client = createInsForgeServerClient();
  const inserted = await client.database
    .from("comment_evidence")
    .insert([
      {
        comment_id: input.commentId,
        type: input.type,
        url: uploaded.url,
        storage_key: uploaded.storageKey,
        metadata_json: input.metadata ?? null,
      },
    ])
    .select("id, type, url, storage_key")
    .single();

  if (inserted.error || !inserted.data) {
    throw new AppError(
      "evidence_attach_failed",
      inserted.error?.message ?? "Unable to attach evidence.",
      500,
    );
  }

  return {
    evidenceId: inserted.data.id,
    type: inserted.data.type,
    url: inserted.data.url,
    storageKey: inserted.data.storage_key,
  };
}
