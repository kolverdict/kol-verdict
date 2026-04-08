import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { getHomeCards, createKol } from "@/lib/backend/kols";
import { requireSession } from "@/lib/backend/auth";
import { createApiRequestContext } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import type { CreateKolResponse, HomeResponse } from "@/lib/types/api";

const createKolSchema = z.object({
  xUsername: z.string().trim().regex(/^[A-Za-z0-9_]{1,15}$/),
  walletAddress: z.string().trim().max(96).optional().nullable(),
  displayName: z.string().trim().max(80).optional().nullable(),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
});

export async function GET(request: Request) {
  const requestContext = createApiRequestContext(request, "api.kols.list");

  try {
    const cards = await getHomeCards();
    return apiSuccessResponse<HomeResponse>(
      {
        cards,
      },
      {
        requestId: requestContext.requestId,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}

export async function POST(request: Request) {
  const requestContext = createApiRequestContext(request, "api.kols.create", { noStore: true });

  try {
    const session = await requireSession();
    requestContext.profileId = session.profileId;
    await assertRateLimit(request, "createKol", session.profileId);
    const payload = createKolSchema.parse(await request.json());
    const result = await createKol(payload, session.profileId);

    return apiSuccessResponse<CreateKolResponse>(result, {
      requestId: requestContext.requestId,
      noStore: true,
    });
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
