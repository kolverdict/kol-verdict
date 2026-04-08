import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/backend/errors";
import type { EvidenceUploadResult } from "@/lib/types/domain";
import { getEnv } from "@/lib/env";
import { createInsForgeServerClient } from "@/lib/insforge/server";

function createStoragePath(prefix: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  return `${prefix}/${Date.now()}-${randomUUID()}-${safeName}`;
}

export async function uploadEvidenceAsset(file: Blob, filename: string) {
  return uploadToBucket(getEnv().INSFORGE_STORAGE_BUCKET_EVIDENCE, file, createStoragePath("evidence", filename));
}

export async function uploadAvatarAsset(file: Blob, filename: string) {
  return uploadToBucket(getEnv().INSFORGE_STORAGE_BUCKET_AVATARS, file, createStoragePath("avatars", filename));
}

async function uploadToBucket(bucketName: string, file: Blob, path: string): Promise<EvidenceUploadResult> {
  const client = createInsForgeServerClient();
  const { data, error } = await client.storage.from(bucketName).upload(path, file);

  if (error || !data) {
    throw new AppError(
      "storage_upload_failed",
      error?.message ?? "Evidence storage upload failed.",
      500,
    );
  }

  return {
    url: (data as { url?: string }).url ?? client.storage.from(bucketName).getPublicUrl(path),
    storageKey: (data as { key?: string }).key ?? path,
  };
}
