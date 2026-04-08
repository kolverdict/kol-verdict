"use client";

import bs58 from "bs58";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
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

  const refresh = useCallback(async () => {
    setStatus((current) => (current === "connecting" || current === "disconnecting" ? current : "loading"));

    try {
      const response = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
      });
      const data = await parseApiResponse<MeResponse>(response);
      setSession(data.session);
      setProfile(data.profile);
      setError(null);
    } catch (nextError) {
      setSession(null);
      setProfile(null);
      setError(toUserFacingApiError(nextError, "Unable to refresh wallet session."));
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

    try {
      const provider = getWalletProvider();
      if (!provider?.connect || !provider.signMessage) {
        throw new Error("Install a Solana wallet like Phantom to continue.");
      }

      const connectResult = await provider.connect();
      const walletAddress = getWalletAddress(provider, connectResult);

      if (!walletAddress) {
        throw new Error("Unable to read the connected wallet address.");
      }

      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
        } satisfies WalletChallengeRequest),
      });
      const challenge = await parseApiResponse<WalletChallengeResponse>(challengeResponse);

      const signature = encodeSignature(
        await provider.signMessage(new TextEncoder().encode(challenge.message), "utf8"),
      );

      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          message: challenge.message,
          signature,
        } satisfies WalletVerifyRequest),
      });
      const verified = await parseApiResponse<WalletVerifyResponse>(verifyResponse);

      setSession(verified.session);
      setProfile(verified.profile);
      setError(null);
      router.refresh();
    } catch (nextError) {
      const safeMessage = toUserFacingApiError(nextError, "Wallet connect failed.", {
        unauthorizedMessage: "Reconnect wallet to continue.",
      });
      setError(safeMessage);
      throw new Error(safeMessage);
    } finally {
      setStatus("idle");
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setStatus("disconnecting");
    setError(null);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
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

  const value = useMemo(
    () => ({
      session,
      profile,
      status,
      error,
      connect,
      signOut,
      refresh,
    }),
    [connect, error, profile, refresh, session, signOut, status],
  );

  return <WalletSessionContext.Provider value={value}>{children}</WalletSessionContext.Provider>;
}

export function useWalletSession() {
  const context = useContext(WalletSessionContext);

  if (!context) {
    throw new Error("useWalletSession must be used within WalletSessionProvider.");
  }

  return context;
}
