import { createClient } from "@insforge/sdk";
import { getRequiredInsforgeEnv } from "@/lib/env";

export function createInsForgeServerClient(accessToken?: string) {
  const env = getRequiredInsforgeEnv();

  return createClient({
    baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: env.INSFORGE_API_KEY,
    isServerMode: true,
    edgeFunctionToken: accessToken,
  });
}
