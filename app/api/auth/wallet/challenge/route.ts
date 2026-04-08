import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { createApiRequestContext } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import { createWalletChallenge, writeWalletChallenge } from "@/lib/insforge/session";
import type { WalletChallengeResponse } from "@/lib/types/api";

const requestSchema = z.object({
  walletAddress: z.string().min(32).max(64),
});

export async function POST(request: Request) {
  const requestContext = createApiRequestContext(request, "api.auth.wallet.challenge", { noStore: true });

  try {
    await assertRateLimit(request, "walletChallenge");
    const body = requestSchema.parse(await request.json());
    const challenge = createWalletChallenge(body.walletAddress);
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
    return apiErrorResponse(error, { context: requestContext });
  }
}
