import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { createApiRequestContext, hashSensitiveValue } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import { createWalletChallenge, writeWalletChallenge } from "@/lib/insforge/session";
import type { WalletChallengeResponse } from "@/lib/types/api";

const requestSchema = z.object({
  walletAddress: z.string().min(32).max(64),
});

export async function POST(request: Request) {
  const requestContext = createApiRequestContext(request, "api.auth.wallet.challenge", { noStore: true });
  let step = "rate_limit";
  let walletAddressHash: string | null = null;

  try {
    await assertRateLimit(request, "walletChallenge");
    step = "parse_request";
    const body = requestSchema.parse(await request.json());
    walletAddressHash = hashSensitiveValue(body.walletAddress);
    step = "create_wallet_challenge";
    const challenge = createWalletChallenge(body.walletAddress);
    step = "write_wallet_challenge_cookie";
    const response = apiSuccessResponse<WalletChallengeResponse>(
      {
        walletAddress: challenge.walletAddress,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
      {
        requestId: requestContext.requestId,
        noStore: true,
      },
    );

    writeWalletChallenge(response.cookies, challenge);
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
          message: error instanceof Error ? error.message : "Unknown wallet challenge failure",
        }),
      );
    }

    return apiErrorResponse(error, { context: requestContext });
  }
}
