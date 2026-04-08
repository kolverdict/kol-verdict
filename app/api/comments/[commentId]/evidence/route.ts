import { z } from "zod";
import { AppError, apiErrorResponse, apiSuccessResponse } from "@/lib/backend/errors";
import { requireSession } from "@/lib/backend/auth";
import { attachEvidenceToComment } from "@/lib/backend/comments";
import { createApiRequestContext } from "@/lib/backend/logging";
import { assertRateLimit } from "@/lib/backend/rate-limit";
import type { AttachEvidenceResponse } from "@/lib/types/api";

const jsonSchema = z.object({
  type: z.enum(["tweet", "tx", "image", "link"]),
  url: z.string().url().max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type Params = Promise<{ commentId: string }>;
const maxEvidenceBytes = 5 * 1024 * 1024;
const allowedEvidenceMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request, context: { params: Params }) {
  const requestContext = createApiRequestContext(request, "api.comments.evidence.create", { noStore: true });

  try {
    const session = await requireSession();
    requestContext.profileId = session.profileId;
    await assertRateLimit(request, "evidence", session.profileId);
    const { commentId } = await context.params;

    let payload:
      | {
          type: "tweet" | "tx" | "image" | "link";
          url?: string;
          metadata?: Record<string, unknown>;
          file?: Blob | null;
          filename?: string;
        }
      | undefined;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const type = z.enum(["tweet", "tx", "image", "link"]).parse(formData.get("type"));
      const url = formData.get("url");
      const file = formData.get("file");
      const metadata = formData.get("metadata");
      payload = {
        type,
        url: typeof url === "string" && url.length > 0 ? url : undefined,
        metadata:
          typeof metadata === "string" && metadata.trim().length > 0
            ? z.record(z.string(), z.unknown()).parse(JSON.parse(metadata))
            : undefined,
        file: file instanceof Blob ? file : null,
        filename: typeof file === "object" && file && "name" in file ? String(file.name) : undefined,
      };
    } else {
      payload = jsonSchema.parse(await request.json());
    }

    if (payload.type === "image") {
      if (!payload.file) {
        throw new AppError("evidence_missing", "Attach an image file to continue.", 400);
      }

      if (payload.file.size > maxEvidenceBytes) {
        throw new AppError("evidence_file_too_large", "Evidence images must be 5 MB or smaller.", 413);
      }

      if (!allowedEvidenceMimeTypes.has(payload.file.type)) {
        throw new AppError(
          "evidence_file_invalid_type",
          "Evidence images must be PNG, JPEG, or WEBP.",
          400,
        );
      }
    } else if (payload.file) {
      throw new AppError("invalid_request", "Only image evidence supports file uploads.", 400);
    }

    const result = await attachEvidenceToComment({
      commentId,
      type: payload.type,
      url: payload.url,
      metadata: payload.metadata,
      file: payload.file,
      filename: payload.filename,
    });

    return apiSuccessResponse<AttachEvidenceResponse>(result, {
      requestId: requestContext.requestId,
      noStore: true,
    });
  } catch (error) {
    return apiErrorResponse(error, { context: requestContext });
  }
}
