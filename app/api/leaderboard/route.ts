import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { getLeaderboardSnapshot } from "@/lib/backend/leaderboard";
import { createApiRequestContext } from "@/lib/backend/logging";
import type { LeaderboardResponse } from "@/lib/types/api";

const searchSchema = z.object({
  tab: z.enum(["trusted", "hated", "trending"]).default("trusted"),
});

export async function GET(request: Request) {
  const requestContext = createApiRequestContext(request, "api.leaderboard");

  try {
    const { searchParams } = new URL(request.url);
    const { tab } = searchSchema.parse(Object.fromEntries(searchParams.entries()));
    const snapshot = await getLeaderboardSnapshot(tab);

    return apiSuccessResponse<LeaderboardResponse>(
      {
        snapshot,
      },
      {
        requestId: requestContext.requestId,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
