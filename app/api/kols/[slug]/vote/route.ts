import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { castKolVote } from "@/lib/backend/kols";
import { requireSession } from "@/lib/backend/auth";
import { createApiRequestContext } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import type { VoteResponse } from "@/lib/types/api";

const requestSchema = z.object({
  direction: z.enum(["love", "hate"]),
  tag: z.string().trim().max(40).optional().nullable(),
});

type Params = Promise<{ slug: string }>;

export async function POST(request: Request, context: { params: Params }) {
  const requestContext = createApiRequestContext(request, "api.kols.vote", { noStore: true });

  try {
    const session = await requireSession();
    requestContext.profileId = session.profileId;
    await assertRateLimit(request, "vote", session.profileId);
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await castKolVote({ kolSlug: slug, direction: body.direction, tag: body.tag ?? null }, session.profileId);

    return apiSuccessResponse<VoteResponse>(result, {
      requestId: requestContext.requestId,
      noStore: true,
    });
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
