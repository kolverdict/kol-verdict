import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { getKolProfileDetail } from "@/lib/backend/kol-intelligence";
import { createApiRequestContext } from "@/lib/backend/logging";
import type { KolProfileDetailResponse } from "@/lib/types/api";

type Params = Promise<{ slug: string }>;

export async function GET(request: Request, context: { params: Params }) {
  const requestContext = createApiRequestContext(request, "api.kols.intelligence");

  try {
    const { slug } = await context.params;
    const profile = await getKolProfileDetail(slug);

    return apiSuccessResponse<KolProfileDetailResponse>(
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
