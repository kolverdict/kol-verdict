import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { getEnv, getSessionSecret } from "@/lib/env";
import type { AppSession } from "@/lib/types/domain";
import { AppError } from "@/lib/backend/errors";

const walletChallengeCookieName = "kol_proof_wallet_challenge";
const appSessionCookieName = "kol_proof_session";
const challengeTtlSeconds = 5 * 60;
const sessionTtlSeconds = 7 * 24 * 60 * 60;

type WalletChallengePayload = {
  walletAddress: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
};

const authCookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: getEnv().NODE_ENV === "production",
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(serialized: string) {
  return createHmac("sha256", getSessionSecret()).update(serialized).digest("base64url");
}

function encodeSignedPayload<T>(payload: T) {
  const serialized = JSON.stringify(payload);
  return `${toBase64Url(serialized)}.${signValue(serialized)}`;
}

function decodeSignedPayload<T>(value?: string | null): T | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, encodedSignature] = value.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const serialized = fromBase64Url(encodedPayload);
  const expectedSignature = signValue(serialized);
  const actual = Buffer.from(encodedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  return JSON.parse(serialized) as T;
}

export function createWalletChallenge(walletAddress: string) {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + challengeTtlSeconds * 1000).toISOString();
  const nonce = randomUUID();
  const message = [
    "KOL Verdict wallet verification",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    "Sign this message to confirm you control this wallet.",
  ].join("\n");

  return {
    walletAddress,
    nonce,
    message,
    issuedAt,
    expiresAt,
  } satisfies WalletChallengePayload;
}

export function writeWalletChallenge(responseCookies: ResponseCookies, payload: WalletChallengePayload) {
  responseCookies.set(walletChallengeCookieName, encodeSignedPayload(payload), {
    ...authCookieBase,
    maxAge: challengeTtlSeconds,
  });
}

export async function readWalletChallenge() {
  const cookieStore = await cookies();
  return decodeSignedPayload<WalletChallengePayload>(cookieStore.get(walletChallengeCookieName)?.value);
}

export function clearWalletChallenge(responseCookies: ResponseCookies) {
  responseCookies.delete(walletChallengeCookieName);
}

export function createAppSession(payload: Omit<AppSession, "issuedAt" | "expiresAt">): AppSession {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString();

  return {
    ...payload,
    issuedAt,
    expiresAt,
  };
}

export function writeAppSession(responseCookies: ResponseCookies, session: AppSession) {
  responseCookies.set(appSessionCookieName, encodeSignedPayload(session), {
    ...authCookieBase,
    maxAge: sessionTtlSeconds,
  });
}

export async function readAppSession() {
  const cookieStore = await cookies();
  const session = decodeSignedPayload<AppSession>(cookieStore.get(appSessionCookieName)?.value);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return session;
}

export function clearAppSession(responseCookies: ResponseCookies) {
  responseCookies.delete(appSessionCookieName);
}

export function assertWalletChallenge(challenge: WalletChallengePayload | null, walletAddress: string, message: string) {
  if (!challenge) {
    throw new AppError("wallet_challenge_missing", "Wallet challenge expired. Please try again.", 400);
  }

  if (challenge.walletAddress !== walletAddress || challenge.message !== message) {
    throw new AppError("wallet_challenge_mismatch", "Wallet challenge does not match this request.", 400);
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    throw new AppError("wallet_challenge_expired", "Wallet challenge expired. Please try again.", 400);
  }
}
