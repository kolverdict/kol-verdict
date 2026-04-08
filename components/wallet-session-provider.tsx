"use client";

import bs58 from "bs58";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { WalletConnectDialog, type WalletPromptOptions } from "@/components/wallet-gate";
import { ApiClientError, parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import type { MeResponse, WalletChallengeRequest, WalletChallengeResponse, WalletVerifyRequest, WalletVerifyResponse } from "@/lib/types/api";
import type { AppProfile, AppSession } from "@/lib/types/domain";

type WalletProviderPublicKey = {
  toBase58: () => string;
};

type WalletProviderConnectResult = {
  publicKey?: WalletProviderPublicKey;
};

type WalletProviderSignResult =
  | Uint8Array
  | {
      signature: Uint8Array;
    };

type SolanaWalletProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: WalletProviderPublicKey | null;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<WalletProviderConnectResult | void>;
  disconnect?: () => Promise<void>;
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<WalletProviderSignResult>;
};

type WalletWindow = Window & {
  solana?: SolanaWalletProvider;
  phantom?: {
    solana?: SolanaWalletProvider;
  };
  solflare?: SolanaWalletProvider;
};

type WalletSessionContextValue = {
  session: AppSession | null;
  profile: AppProfile | null;
  status: "loading" | "idle" | "connecting" | "disconnecting";
  error: string | null;
  connect: () => Promise<void>;
  requireWalletForWrite: (options?: WalletPromptOptions) => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const WalletSessionContext = createContext<WalletSessionContextValue | null>(null);

function getWalletProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const walletWindow = window as WalletWindow;
  return walletWindow.phantom?.solana ?? walletWindow.solana ?? walletWindow.solflare ?? null;
}

function getWalletAddress(
  provider: SolanaWalletProvider,
  connectResult?: WalletProviderConnectResult | void,
) {
  return connectResult?.publicKey?.toBase58?.() ?? provider.publicKey?.toBase58?.() ?? null;
}

function encodeSignature(result: WalletProviderSignResult) {
  const signature = result instanceof Uint8Array ? result : result.signature;
  return bs58.encode(signature);
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

type WalletConnectStep =
  | "session_refresh"
  | "provider_connect"
  | "challenge_request"
  | "signature_request"
  | "verify_request"
  | "post_verify_session";

function formatWalletForLog(address: string | null) {
  if (!address) {
    return null;
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function logWalletDevEvent(level: "info" | "error", message: string, payload?: Record<string, unknown>) {
  if (!isDevelopment()) {
    return;
  }

  const entry = {
    scope: "wallet_auth",
    level,
    message,
    ...payload,
  };

  const logger = level === "error" ? console.error : console.info;
  logger("[wallet-auth]", entry);
}

function formatWalletConnectError(step: WalletConnectStep, error: unknown) {
  const fallbackMessage = "Wallet connect failed.";
  const safeMessage = toUserFacingApiError(error, fallbackMessage, {
    unauthorizedMessage: "Reconnect wallet to continue.",
  });

  if (!isDevelopment()) {
    return safeMessage;
  }

  if (error instanceof ApiClientError) {
    const parts = ["Connection failed."];

    if (error.requestId) {
      parts.push(`Request ${error.requestId}.`);
    }

    parts.push("Check the dev console.");
    return parts.join(" ");
  }

  if (error instanceof Error && error.message.trim()) {
    return "Connection failed. Check the dev console.";
  }

  return "Connection failed. Check the dev console.";
}

export function shortWalletLabel(address: string | null | undefined) {
  if (!address) return "Connect Wallet";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [status, setStatus] = useState<WalletSessionContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [walletPrompt, setWalletPrompt] = useState<WalletPromptOptions | null>(null);
  const promptResolveRef = useRef<((granted: boolean) => void) | null>(null);
  const promptPromiseRef = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback(async () => {
    setStatus((current) => (current === "connecting" || current === "disconnecting" ? current : "loading"));

    try {
      const response = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await parseApiResponse<MeResponse>(response);
      setSession(data.session);
      setProfile(data.profile);
      setError(null);
    } catch (nextError) {
      setSession(null);
      setProfile(null);
      const safeMessage = toUserFacingApiError(nextError, "Unable to refresh wallet session.");
      setError(safeMessage);
      logWalletDevEvent("error", "wallet session refresh failed", {
        step: "session_refresh",
        message: formatWalletConnectError("session_refresh", nextError),
        statusCode: nextError instanceof ApiClientError ? nextError.statusCode : null,
        code: nextError instanceof ApiClientError ? nextError.code ?? null : null,
        requestId: nextError instanceof ApiClientError ? nextError.requestId ?? null : null,
      });
    } finally {
      setStatus((current) => (current === "loading" ? "idle" : current));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    let step: WalletConnectStep = "provider_connect";
    let walletAddress: string | null = null;

    try {
      const provider = getWalletProvider();
      if (!provider?.connect || !provider.signMessage) {
        throw new Error("Install a Solana wallet like Phantom to continue.");
      }

      const connectResult = await provider.connect();
      walletAddress = getWalletAddress(provider, connectResult);

      if (!walletAddress) {
        throw new Error("Unable to read the connected wallet address.");
      }

      step = "challenge_request";
      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          walletAddress,
        } satisfies WalletChallengeRequest),
      });
      const challenge = await parseApiResponse<WalletChallengeResponse>(challengeResponse);
      logWalletDevEvent("info", "wallet challenge request succeeded", {
        step,
        walletAddress: formatWalletForLog(walletAddress),
        requestId: challengeResponse.headers.get("x-request-id"),
      });

      step = "signature_request";
      const signature = encodeSignature(
        await provider.signMessage(new TextEncoder().encode(challenge.message), "utf8"),
      );
      logWalletDevEvent("info", "wallet signature request succeeded", {
        step,
        walletAddress: formatWalletForLog(walletAddress),
      });

      step = "verify_request";
      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          walletAddress,
          message: challenge.message,
          signature,
        } satisfies WalletVerifyRequest),
      });
      const verified = await parseApiResponse<WalletVerifyResponse>(verifyResponse);
      logWalletDevEvent("info", "wallet verify request succeeded", {
        step,
        walletAddress: formatWalletForLog(walletAddress),
        requestId: verifyResponse.headers.get("x-request-id"),
      });

      let resolvedSession = verified.session;
      let resolvedProfile = verified.profile;

      if (isDevelopment()) {
        step = "post_verify_session";
        const meResponse = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        const meData = await parseApiResponse<MeResponse>(meResponse);

        if (!meData.session || !meData.profile) {
          throw new Error(
            `Wallet verify succeeded but /api/me returned no authenticated session. Check that you are using one localhost host consistently and that the dev server restarted with the current env. Request ${meResponse.headers.get("x-request-id") ?? "unknown"}.`,
          );
        }

        resolvedSession = meData.session;
        resolvedProfile = meData.profile;
        logWalletDevEvent("info", "post-verify session check succeeded", {
          step,
          walletAddress: formatWalletForLog(walletAddress),
          requestId: meResponse.headers.get("x-request-id"),
          profileId: meData.session.profileId,
        });
      }

      setSession(resolvedSession);
      setProfile(resolvedProfile);
      setError(null);
      router.refresh();
    } catch (nextError) {
      const safeMessage = formatWalletConnectError(step, nextError);
      logWalletDevEvent("error", "wallet connect failed", {
        step,
        walletAddress: formatWalletForLog(walletAddress),
        message: safeMessage,
        statusCode: nextError instanceof ApiClientError ? nextError.statusCode : null,
        code: nextError instanceof ApiClientError ? nextError.code ?? null : null,
        requestId: nextError instanceof ApiClientError ? nextError.requestId ?? null : null,
      });
      setError(safeMessage);
      throw new Error(safeMessage);
    } finally {
      setStatus("idle");
    }
  }, [router]);

  const closeWalletPrompt = useCallback((granted: boolean) => {
    setWalletPrompt(null);

    if (promptResolveRef.current) {
      promptResolveRef.current(granted);
      promptResolveRef.current = null;
    }

    promptPromiseRef.current = null;
  }, []);

  const requireWalletForWrite = useCallback(
    async (options?: WalletPromptOptions) => {
      if (session) {
        return true;
      }

      if (promptPromiseRef.current) {
        return promptPromiseRef.current;
      }

      const pendingPrompt = new Promise<boolean>((resolve) => {
        promptResolveRef.current = resolve;
      });

      promptPromiseRef.current = pendingPrompt;
      setWalletPrompt(options ?? {});

      return pendingPrompt;
    },
    [session],
  );

  const signOut = useCallback(async () => {
    setStatus("disconnecting");
    setError(null);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
      });

      const provider = getWalletProvider();
      await provider?.disconnect?.();
      setSession(null);
      setProfile(null);
      router.refresh();
    } catch (nextError) {
      const safeMessage = toUserFacingApiError(nextError, "Wallet disconnect failed.");
      setError(safeMessage);
      throw new Error(safeMessage);
    } finally {
      setStatus("idle");
    }
  }, [router]);

  useEffect(() => {
    if (session && walletPrompt) {
      closeWalletPrompt(true);
    }
  }, [closeWalletPrompt, session, walletPrompt]);

  useEffect(() => {
    return () => {
      if (promptResolveRef.current) {
        promptResolveRef.current(false);
        promptResolveRef.current = null;
      }

      promptPromiseRef.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      status,
      error,
      connect,
      requireWalletForWrite,
      signOut,
      refresh,
    }),
    [connect, error, profile, refresh, requireWalletForWrite, session, signOut, status],
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
      <WalletConnectDialog
        open={walletPrompt !== null}
        busy={status === "connecting" || status === "disconnecting"}
        error={error}
        onConnect={connect}
        onClose={() => closeWalletPrompt(false)}
        onSuccess={() => closeWalletPrompt(true)}
        title={walletPrompt?.title}
        message={walletPrompt?.message}
        buttonLabel={walletPrompt?.buttonLabel}
        className={walletPrompt?.className}
        cardClassName={walletPrompt?.cardClassName}
        buttonClassName={walletPrompt?.buttonClassName}
        eyebrow={walletPrompt?.eyebrow}
        footer={walletPrompt?.footer}
      />
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession() {
  const context = useContext(WalletSessionContext);

  if (!context) {
    throw new Error("useWalletSession must be used within WalletSessionProvider.");
  }

  return context;
}
