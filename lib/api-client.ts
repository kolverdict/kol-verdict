import type { ApiResponse } from "@/lib/types/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly retryAfter?: number | null,
    public readonly requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function parseApiResponse<T>(response: Response) {
  const requestId = response.headers.get("x-request-id");
  const retryAfter = Number(response.headers.get("Retry-After")) || null;
  const payload = await response.text();
  let result: ApiResponse<T>;

  try {
    result = JSON.parse(payload) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "Invalid API response.",
      response.status || 500,
      "invalid_response",
      retryAfter,
      requestId,
    );
  }

  if (!response.ok || !result.ok) {
    const message = result.ok ? "Request failed." : result.error.message;
    const code = result.ok ? "request_failed" : result.error.code;
    throw new ApiClientError(
      message,
      response.status || (result.ok ? 500 : result.error.statusCode),
      code,
      retryAfter,
      requestId,
    );
  }

  return result.data;
}

export function toUserFacingApiError(
  error: unknown,
  fallbackMessage: string,
  options: {
    unauthorizedMessage?: string;
  } = {},
) {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 401) {
      return options.unauthorizedMessage ?? "Reconnect wallet to continue.";
    }

    if (error.statusCode === 429) {
      return "Too many attempts. Please wait and try again.";
    }

    if (error.statusCode >= 500) {
      return "Service temporarily unavailable. Please try again.";
    }

    if (error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
