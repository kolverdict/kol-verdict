import { apiSuccessResponse } from "@/lib/backend/errors";
import { createApiRequestContext } from "@/lib/backend/logging";
import { clearAppSession, clearWalletChallenge } from "@/lib/insforge/session";

export async function POST(request: Request) {
  const requestContext = createApiRequestContext(request, "api.auth.sign_out", { noStore: true });
  const response = apiSuccessResponse({ signedOut: true }, {
    requestId: requestContext.requestId,
    noStore: true,
  });
  clearWalletChallenge(response.cookies);
  clearAppSession(response.cookies);
  return response;
}
