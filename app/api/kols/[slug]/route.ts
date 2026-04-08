import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { getKolProfile } from "@/lib/backend/kols";
import { createApiRequestContext } from "@/lib/backend/logging";
import type { KolProfileResponse } from "@/lib/types/api";

type Params = Promise<{ slug: string }>;

export async function GET(request: Request, context: { params: Params }) {
  const requestContext = createApiRequestContext(request, "api.kols.profile");

  try {
    const { slug } = await context.params;
    const profile = await getKolProfile(slug);

    return apiSuccessResponse<KolProfileResponse>(
      {
        profile,
      },
      {
        requestId: requestContext.requestId,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
