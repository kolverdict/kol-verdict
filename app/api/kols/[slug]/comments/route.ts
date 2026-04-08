import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { requireSession } from "@/lib/backend/auth";
import { createKolComment } from "@/lib/backend/comments";
import { createApiRequestContext } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import type { CreateCommentResponse } from "@/lib/types/api";

const requestSchema = z.object({
  body: z.string().trim().min(3).max(1000),
  tag: z.string().trim().max(40).optional().nullable(),
  feeAmount: z.string().trim().max(32).optional(),
});

type Params = Promise<{ slug: string }>;

export async function POST(request: Request, context: { params: Params }) {
  const requestContext = createApiRequestContext(request, "api.kols.comments.create", { noStore: true });

  try {
    const session = await requireSession();
    requestContext.profileId = session.profileId;
    await assertRateLimit(request, "comment", session.profileId);
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await createKolComment(
      {
        kolSlug: slug,
        body: body.body,
        tag: body.tag ?? null,
        feeAmount: body.feeAmount,
      },
      session.profileId,
    );

    return apiSuccessResponse<CreateCommentResponse>(result, {
      requestId: requestContext.requestId,
      noStore: true,
    });
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
