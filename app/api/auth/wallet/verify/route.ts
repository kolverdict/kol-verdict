import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { createSessionPayload, upsertProfileFromWallet, verifySolanaWalletSignature } from "@/lib/backend/auth";
import { createApiRequestContext, hashSensitiveValue } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import { assertWalletChallenge, clearWalletChallenge, createAppSession, readWalletChallenge, writeAppSession } from "@/lib/insforge/session";
import type { WalletVerifyResponse } from "@/lib/types/api";

const requestSchema = z.object({
  walletAddress: z.string().min(32).max(64),
  message: z.string().min(10),
  signature: z.string().min(10),
  username: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  const requestContext = createApiRequestContext(request, "api.auth.wallet.verify", { noStore: true });
  let step = "rate_limit";
  let walletAddressHash: string | null = null;
  let challengePresent = false;

  try {
    await assertRateLimit(request, "walletVerify");
    step = "parse_request";
    const body = requestSchema.parse(await request.json());
    walletAddressHash = hashSensitiveValue(body.walletAddress);
    step = "read_wallet_challenge";
    const challenge = await readWalletChallenge();
    challengePresent = Boolean(challenge);

    step = "assert_wallet_challenge";
    assertWalletChallenge(challenge, body.walletAddress, body.message);
    step = "verify_wallet_signature";
    verifySolanaWalletSignature(body.walletAddress, body.message, body.signature);

    step = "upsert_profile";
    const profile = await upsertProfileFromWallet({
      walletAddress: body.walletAddress,
      walletChain: "solana",
      username: body.username ?? null,
      avatarUrl: body.avatarUrl ?? null,
    });
    requestContext.profileId = profile.id;
    step = "write_app_session";
    const session = createAppSession(createSessionPayload(profile));
    const response = apiSuccessResponse<WalletVerifyResponse>(
      {
        session,
        profile,
      },
      {
        requestId: requestContext.requestId,
        noStore: true,
      },
    );

    clearWalletChallenge(response.cookies);
    writeAppSession(response.cookies, session);
    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        JSON.stringify({
          scope: "wallet_auth",
          level: "error",
          route: requestContext.route,
          requestId: requestContext.requestId,
          step,
          walletAddressHash,
          challengePresent,
          profileId: requestContext.profileId ?? null,
          message: error instanceof Error ? error.message : "Unknown wallet verify failure",
        }),
      );
    }

    return apiErrorResponse(error, { context: requestContext });
  }
}
