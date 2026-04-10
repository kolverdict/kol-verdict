import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiFailure } from "@/lib/types/api";
import type { ApiRequestContext } from "@/lib/backend/logging";
import { logApiError } from "@/lib/backend/logging";

export const BACKEND_NOT_CONFIGURED_MESSAGE =
  "InsForge backend is not configured. Set NEXT_PUBLIC_INSFORGE_URL, INSFORGE_API_KEY, KOL_PROOF_SESSION_SECRET, and one project id env: INSFORGE_PROJECT_ID, NEXT_PUBLIC_PROJECT_ID, or NEXT_PUBLIC_REOWN_PROJECT_ID.";
export const GENERIC_SERVER_ERROR_MESSAGE = "Service temporarily unavailable. Please try again.";

type AppErrorOptions = {
  retryAfterSeconds?: number;
  logDetails?: Record<string, unknown> | null;
};

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = "AppError";
  }

  get retryAfterSeconds() {
    return this.options.retryAfterSeconds;
  }

  get logDetails() {
    return this.options.logDetails ?? null;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function backendNotConfiguredError() {
  return new AppError("backend_not_configured", BACKEND_NOT_CONFIGURED_MESSAGE, 503);
}

function serializeObjectError(error: Record<string, unknown>) {
  return Object.entries(error).reduce<Record<string, unknown>>((result, [key, value]) => {
    if (typeof value === "function" || value === undefined) {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
}

export function toAppError(error: unknown, fallbackMessage = "Unexpected server error") {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(
      "invalid_request",
      error.issues[0]?.message ?? "Invalid request payload.",
      400,
      {
        logDetails: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        },
      },
    );
  }

  if (error instanceof Error) {
    return new AppError("internal_error", error.message || fallbackMessage, 500);
  }

  if (error && typeof error === "object") {
    const serialized = serializeObjectError(error as Record<string, unknown>);
    const upstreamMessage =
      typeof serialized.message === "string" && serialized.message.trim()
        ? serialized.message
        : fallbackMessage;

    return new AppError("internal_error", upstreamMessage, 500, {
      logDetails: serialized,
    });
  }

  return new AppError("internal_error", fallbackMessage, 500);
}

function buildResponseHeaders({
  requestId,
  noStore,
  retryAfterSeconds,
}: {
  requestId?: string;
  noStore?: boolean;
  retryAfterSeconds?: number;
}) {
  const headers = new Headers();

  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  if (noStore) {
    headers.set("Cache-Control", "no-store");
  }

  if (retryAfterSeconds && retryAfterSeconds > 0) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }

  return headers;
}

export function apiSuccessResponse<T>(
  data: T,
  options: { status?: number; requestId?: string; noStore?: boolean } = {},
) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    {
      status: options.status ?? 200,
      headers: buildResponseHeaders({
        requestId: options.requestId,
        noStore: options.noStore,
      }),
    },
  );
}

export function apiErrorResponse(
  error: unknown,
  options: {
    requestId?: string;
    noStore?: boolean;
    context?: ApiRequestContext;
  } = {},
) {
  const appError = toAppError(error);
  const publicMessage = appError.statusCode >= 500 ? GENERIC_SERVER_ERROR_MESSAGE : appError.message;
  const body: ApiFailure = {
    ok: false,
    error: {
      code: appError.code,
      message: publicMessage,
      statusCode: appError.statusCode,
    },
  };

  logApiError({
    context: options.context,
    appError: {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      retryAfterSeconds: appError.retryAfterSeconds,
      logDetails: appError.logDetails,
    },
    error,
  });

  return NextResponse.json(body, {
    status: appError.statusCode,
    headers: buildResponseHeaders({
      requestId: options.requestId ?? options.context?.requestId,
      noStore: options.noStore ?? options.context?.noStore,
      retryAfterSeconds: appError.retryAfterSeconds,
    }),
  });
}
