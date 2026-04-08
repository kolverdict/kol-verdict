import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { getCurrentSession } from "@/lib/backend/auth";
import { createApiRequestContext } from "@/lib/backend/logging";
import { getCurrentUserProfileView } from "@/lib/backend/profiles";
import type { MeResponse } from "@/lib/types/api";

export async function GET(request: Request) {
  const requestContext = createApiRequestContext(request, "api.me", { noStore: true });

  try {
    const session = await getCurrentSession();
    const userProfile = await getCurrentUserProfileView();
    requestContext.profileId = session?.profileId ?? null;

    if (!session || !userProfile) {
      return apiSuccessResponse<MeResponse>(
        {
          session: null,
          profile: null,
          userProfile: null,
        },
        {
          requestId: requestContext.requestId,
          noStore: true,
        },
      );
    }

    return apiSuccessResponse<MeResponse>(
      {
        session,
        profile: userProfile.profile,
        userProfile,
      },
      {
        requestId: requestContext.requestId,
        noStore: true,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
