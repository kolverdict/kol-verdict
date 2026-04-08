import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { createSessionPayload, upsertProfileFromWallet, verifySolanaWalletSignature } from "@/lib/backend/auth";
import { createApiRequestContext } from "@/lib/backend/logging";
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

  try {
    await assertRateLimit(request, "walletVerify");
    const body = requestSchema.parse(await request.json());
    const challenge = await readWalletChallenge();

    assertWalletChallenge(challenge, body.walletAddress, body.message);
    verifySolanaWalletSignature(body.walletAddress, body.message, body.signature);

    const profile = await upsertProfileFromWallet({
      walletAddress: body.walletAddress,
      walletChain: "solana",
      username: body.username ?? null,
      avatarUrl: body.avatarUrl ?? null,
    });
    requestContext.profileId = profile.id;
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
    return apiErrorResponse(error, { context: requestContext });
  }
}
