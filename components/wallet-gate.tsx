"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";
import { cx } from "@/lib/utils";

export type WalletPromptOptions = {
  title?: string;
  message?: string;
  buttonLabel?: string;
  className?: string;
  cardClassName?: string;
  buttonClassName?: string;
  eyebrow?: ReactNode;
  footer?: ReactNode;
};

type WalletConnectPromptProps = WalletPromptOptions & {
  busy?: boolean;
  error?: string | null;
  onConnect: () => Promise<void> | void;
  onSuccess?: () => void;
  onCancel?: () => void;
  showDismiss?: boolean;
};

function resolvedButtonLabel({
  walletBusy,
  buttonLabel,
  connectError,
  error,
}: {
  walletBusy: boolean;
  buttonLabel?: string;
  connectError: string | null;
  error?: string | null;
}) {
  if (walletBusy) {
    return "Connecting...";
  }

  if (buttonLabel) {
    return buttonLabel;
  }

  return error || connectError ? "Retry connection" : "Connect Phantom";
}

export function WalletConnectPrompt({
  title = "Connect wallet to submit your verdict",
  message = "Connect your wallet to unlock this action.",
  buttonLabel,
  busy = false,
  error,
  className,
  cardClassName,
  buttonClassName,
  eyebrow,
  footer,
  onConnect,
  onSuccess,
  onCancel,
  showDismiss = false,
}: WalletConnectPromptProps) {
  const [connectError, setConnectError] = useState<string | null>(null);
  const walletBusy = busy;

  async function handleConnect() {
    if (walletBusy) {
      return;
    }

    try {
      setConnectError(null);
      await onConnect();
      onSuccess?.();
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.trim()) {
        setConnectError(nextError.message);
        return;
      }

      setConnectError("Wallet connect failed.");
    }
  }

  return (
    <div className={cx("mx-auto w-full", className)}>
      <div
        className={cx(
          "mx-auto flex w-full max-w-[20rem] flex-col items-center rounded-[1.35rem] border border-white/8 bg-surface-container-high/95 px-5 py-5 text-center shadow-surface backdrop-blur-xl",
          cardClassName,
        )}
      >
        {showDismiss ? (
          <div className="mb-3 flex w-full justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="kv-focus-ring rounded-full p-1 text-on-surface-variant transition-colors hover:text-white"
              aria-label="Close wallet dialog"
            >
              <Icon name="close" className="text-[1.1rem]" />
            </button>
          </div>
        ) : null}

        {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
        <h3 className="font-display text-[1.25rem] font-black tracking-[-0.035em] text-white [word-spacing:0.08em]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">{message}</p>
        {footer ? <div className="mt-5 w-full">{footer}</div> : null}
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={walletBusy}
          className={cx(
            "kv-focus-ring mt-5 rounded-xl border border-secondary/22 bg-secondary/12 px-6 py-3 font-label text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-secondary transition-colors duration-200 hover:bg-secondary/18 disabled:cursor-not-allowed disabled:opacity-70",
            buttonClassName,
          )}
        >
          {resolvedButtonLabel({ walletBusy, buttonLabel, connectError, error })}
        </button>
        {connectError || error ? (
          <p aria-live="polite" className="mt-3 text-center font-display text-[0.56rem] font-bold uppercase tracking-[0.18em] text-tertiary">
            {connectError ?? error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type WalletConnectDialogProps = WalletPromptOptions & {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onConnect: () => Promise<void> | void;
  onClose: () => void;
  onSuccess: () => void;
};

export function WalletConnectDialog({
  open,
  busy,
  error,
  onConnect,
  onClose,
  onSuccess,
  title,
  message,
  buttonLabel,
  className,
  cardClassName,
  buttonClassName,
  eyebrow,
  footer,
}: WalletConnectDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/62 px-4 py-6 backdrop-blur-md sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[22rem]"
          >
            <WalletConnectPrompt
              title={title}
              message={message}
              buttonLabel={buttonLabel}
              busy={busy}
              error={error}
              className={className}
              cardClassName={cardClassName}
              buttonClassName={buttonClassName}
              eyebrow={eyebrow}
              footer={footer}
              onConnect={onConnect}
              onSuccess={onSuccess}
              onCancel={onClose}
              showDismiss
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
