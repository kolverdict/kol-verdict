import { z } from "zod";
import { backendNotConfiguredError } from "@/lib/backend/errors";

const nullableString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_INSFORGE_URL: nullableString,
  NEXT_PUBLIC_INSFORGE_ANON_KEY: nullableString,
  NEXT_PUBLIC_PROJECT_ID: nullableString,
  NEXT_PUBLIC_REOWN_PROJECT_ID: nullableString,
  INSFORGE_API_KEY: nullableString,
  INSFORGE_PROJECT_ID: nullableString,
  INSFORGE_STORAGE_BUCKET_EVIDENCE: nullableString.default("evidence"),
  INSFORGE_STORAGE_BUCKET_AVATARS: nullableString.default("avatars"),
  KOL_PROOF_SESSION_SECRET: nullableString,
  KOL_PROOF_COMMENT_FEE_ETH: nullableString.default("0.05"),
});

export type AppEnv = ReturnType<typeof readEnv>;
export type RequiredBackendEnv = AppEnv & {
  NEXT_PUBLIC_INSFORGE_URL: string;
  NEXT_PUBLIC_INSFORGE_ANON_KEY?: string;
  INSFORGE_API_KEY: string;
  INSFORGE_PROJECT_ID: string;
  KOL_PROOF_SESSION_SECRET: string;
};

function readEnv() {
  const parsed = envSchema.parse(process.env);
  const projectId = parsed.INSFORGE_PROJECT_ID ?? parsed.NEXT_PUBLIC_PROJECT_ID ?? parsed.NEXT_PUBLIC_REOWN_PROJECT_ID;
  const hasInsforgeConfig = Boolean(
    parsed.NEXT_PUBLIC_INSFORGE_URL &&
      parsed.INSFORGE_API_KEY &&
      projectId &&
      parsed.KOL_PROOF_SESSION_SECRET,
  );

  return {
    ...parsed,
    INSFORGE_PROJECT_ID: projectId,
    hasInsforgeConfig,
  };
}

let cachedEnv: AppEnv | null = null;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = readEnv();
  }

  return cachedEnv;
}

export function hasInsforgeServerEnv() {
  return getEnv().hasInsforgeConfig;
}

export function getRequiredInsforgeEnv(): RequiredBackendEnv {
  const env = getEnv();

  if (
    !env.NEXT_PUBLIC_INSFORGE_URL ||
    !env.INSFORGE_API_KEY ||
    !env.INSFORGE_PROJECT_ID ||
    !env.KOL_PROOF_SESSION_SECRET
  ) {
    throw backendNotConfiguredError();
  }

  return {
    ...env,
    NEXT_PUBLIC_INSFORGE_URL: env.NEXT_PUBLIC_INSFORGE_URL,
    INSFORGE_API_KEY: env.INSFORGE_API_KEY,
    INSFORGE_PROJECT_ID: env.INSFORGE_PROJECT_ID,
    KOL_PROOF_SESSION_SECRET: env.KOL_PROOF_SESSION_SECRET,
  };
}

export function getSessionSecret() {
  const env = getRequiredInsforgeEnv();

  if (env.NODE_ENV === "production" && env.KOL_PROOF_SESSION_SECRET === "change-me-in-production") {
    throw new Error("KOL_PROOF_SESSION_SECRET must be rotated before running in production.");
  }

  return env.KOL_PROOF_SESSION_SECRET;
}
