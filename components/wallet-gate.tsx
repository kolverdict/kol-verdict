"use client";

import { useState, type ReactNode } from "react";
import { useWalletSession } from "@/components/wallet-session-provider";
import { cx } from "@/lib/utils";

type WalletGateProps = {
  children: ReactNode;
  variant?: "overlay" | "replace";
  title?: string;
  message?: string;
  buttonLabel?: string;
  className?: string;
  contentClassName?: string;
  cardClassName?: string;
  buttonClassName?: string;
  eyebrow?: ReactNode;
  footer?: ReactNode;
};

export function WalletGate({
  children,
  variant = "overlay",
  title = "Connect wallet to continue",
  message = "Connect your wallet to unlock this action.",
  buttonLabel,
  className,
  contentClassName,
  cardClassName,
  buttonClassName,
  eyebrow,
  footer,
}: WalletGateProps) {
  const { session, status, error, connect } = useWalletSession();
  const [connectError, setConnectError] = useState<string | null>(null);

  if (session) {
    return <>{children}</>;
  }

  const walletBusy = status === "connecting" || status === "disconnecting";
  const resolvedButtonLabel = walletBusy
    ? "Connecting..."
    : buttonLabel ?? (error || connectError ? "Retry Wallet" : "Connect Wallet");

  async function handleConnect() {
    if (walletBusy) {
      return;
    }

    try {
      setConnectError(null);
      await connect();
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.trim()) {
        setConnectError(nextError.message);
        return;
      }

      setConnectError("Wallet connect failed.");
    }
  }

  const gateCard = (
    <div
      className={cx(
        "mx-auto flex w-full max-w-[20rem] flex-col items-center rounded-[1.5rem] border border-white/8 bg-surface-container-high/95 px-5 py-5 text-center shadow-[0_24px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        cardClassName,
      )}
    >
      {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
      <h3 className="font-display text-[1.3rem] font-black tracking-[-0.06em] text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{message}</p>
      {footer ? <div className="mt-5 w-full">{footer}</div> : null}
      <button
        type="button"
        onClick={() => void handleConnect()}
        disabled={walletBusy}
        className={cx(
          "mt-5 rounded-xl border border-secondary/20 bg-secondary/10 px-6 py-3 font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 hover:bg-secondary/16 disabled:cursor-not-allowed disabled:opacity-70",
          buttonClassName,
        )}
      >
        {resolvedButtonLabel}
      </button>
      {connectError || error ? (
        <p aria-live="polite" className="mt-3 text-center font-display text-[0.56rem] font-bold uppercase tracking-[0.18em] text-tertiary">
          {connectError ?? error}
        </p>
      ) : null}
    </div>
  );

  if (variant === "replace") {
    return <div className={cx("relative", className)}>{gateCard}</div>;
  }

  return (
    <div className={cx("relative", className)}>
      <div aria-hidden className={cx("transition-all duration-300 pointer-events-none select-none opacity-40 blur-[3px]", contentClassName)}>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4">{gateCard}</div>
    </div>
  );
}
