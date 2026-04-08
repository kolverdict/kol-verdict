import { hasInsforgeServerEnv, getRequiredInsforgeEnv } from "@/lib/env";

export type InsForgePublicAuthConfig = {
  requireEmailVerification: boolean;
  passwordMinLength: number;
  verifyEmailMethod: "code" | "link";
  resetPasswordMethod: "code" | "link";
  oAuthProviders: string[];
};

const defaultPublicConfig: InsForgePublicAuthConfig = {
  requireEmailVerification: false,
  passwordMinLength: 8,
  verifyEmailMethod: "code",
  resetPasswordMethod: "link",
  oAuthProviders: [],
};

export async function getInsForgePublicAuthConfig() {
  if (!hasInsforgeServerEnv()) {
    return defaultPublicConfig;
  }

  const env = getRequiredInsforgeEnv();

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_INSFORGE_URL}/api/auth/public-config`, {
      headers: {
        Authorization: `Bearer ${env.INSFORGE_API_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return defaultPublicConfig;
    }

    return (await response.json()) as InsForgePublicAuthConfig;
  } catch {
    return defaultPublicConfig;
  }
}
