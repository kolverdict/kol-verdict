import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { createApiRequestContext } from "@/lib/backend/logging";
import { searchKol } from "@/lib/backend/kols";
import type { KolSearchResponse } from "@/lib/types/api";

const searchSchema = z.object({
  query: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  const requestContext = createApiRequestContext(request, "api.kols.search");

  try {
    const { searchParams } = new URL(request.url);
    const { query } = searchSchema.parse(Object.fromEntries(searchParams.entries()));
    const match = await searchKol(query);

    return apiSuccessResponse<KolSearchResponse>(
      {
        match: match ? { slug: match.slug } : null,
      },
      {
        requestId: requestContext.requestId,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
