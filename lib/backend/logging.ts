import { createHash, randomUUID } from "node:crypto";

export type ApiRequestContext = {
  requestId: string;
  route: string;
  method: string;
  pathname: string;
  clientIpHash: string | null;
  profileId?: string | null;
  noStore?: boolean;
};

type SerializableRecord = Record<string, unknown>;

function toSerializableObject(value: unknown): SerializableRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return Object.entries(value as Record<string, unknown>).reduce<SerializableRecord>((result, [key, entry]) => {
    if (entry === undefined) {
      return result;
    }

    result[key] = entry;
    return result;
  }, {});
}

function extractClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return null;
}

export function hashSensitiveValue(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function createApiRequestContext(
  request: Request,
  route: string,
  options: { profileId?: string | null; noStore?: boolean } = {},
): ApiRequestContext {
  const url = new URL(request.url);
  const clientIp = extractClientIp(request.headers);

  return {
    requestId: request.headers.get("x-request-id")?.trim() || randomUUID(),
    route,
    method: request.method,
    pathname: url.pathname,
    clientIpHash: clientIp ? hashSensitiveValue(clientIp) : null,
    profileId: options.profileId ?? null,
    noStore: options.noStore,
  };
}

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      cause: toSerializableObject(error.cause) ?? null,
    };
  }

  return {
    value: error,
  };
}

export function logApiError(payload: {
  context?: ApiRequestContext;
  appError: {
    code: string;
    message: string;
    statusCode: number;
    retryAfterSeconds?: number;
    logDetails?: Record<string, unknown> | null;
  };
  error: unknown;
}) {
  const entry = {
    level: "error",
    timestamp: new Date().toISOString(),
    requestId: payload.context?.requestId ?? null,
    route: payload.context?.route ?? null,
    method: payload.context?.method ?? null,
    pathname: payload.context?.pathname ?? null,
    clientIpHash: payload.context?.clientIpHash ?? null,
    profileId: payload.context?.profileId ?? null,
    error: {
      code: payload.appError.code,
      message: payload.appError.message,
      statusCode: payload.appError.statusCode,
      retryAfterSeconds: payload.appError.retryAfterSeconds ?? null,
      logDetails: payload.appError.logDetails ?? null,
    },
    originalError: serializeUnknownError(payload.error),
  };

  console.error(JSON.stringify(entry));
}
