"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { WalletGate } from "@/components/wallet-gate";
import { useWalletSession } from "@/components/wallet-session-provider";
import { Icon } from "@/components/ui";
import { parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import { brandAvatar } from "@/lib/mock-data";
import type { CreateKolRequest, CreateKolResponse } from "@/lib/types/api";
import { cx } from "@/lib/utils";

type FieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  accent?: "secondary" | "muted";
  prefix?: string;
  displayFont?: boolean;
  disabled?: boolean;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  accent = "muted",
  prefix,
  displayFont = false,
  disabled = false,
}: FieldProps) {
  return (
    <div className="group">
      <label
        htmlFor={id}
        className={cx(
          "mb-3 ml-1 block font-display text-xs font-bold uppercase tracking-widest",
          accent === "secondary" ? "text-secondary" : "text-on-surface-variant",
        )}
      >
        {label}
      </label>

      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-[1.4rem] tracking-[-0.04em] text-on-surface-variant">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cx(
            "w-full bg-transparent px-4 py-4 text-on-surface placeholder:text-zinc-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            prefix ? "pl-10 pr-4" : "px-4",
            displayFont ? "font-display text-lg tracking-[-0.04em]" : "font-display tracking-[-0.03em]",
          )}
        />
        {accent === "secondary" ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-secondary transition-transform duration-500 group-focus-within:scale-x-100" />
        ) : null}
      </div>
    </div>
  );
}

function RegistryPreview({
  username,
  wallet,
  compact = false,
}: {
  username: string;
  wallet: string;
  compact?: boolean;
}) {
  const hasUsername = username.trim().length > 0;
  const normalizedWallet = wallet.trim();

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-high shadow-[0px_24px_48px_rgba(0,0,0,0.4)]",
        compact ? "p-8" : "p-8",
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-secondary/5 blur-[80px]" />

      <div className="relative flex items-center gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-secondary/20 bg-surface-container-highest">
          <Icon name="person" className="text-4xl text-zinc-600" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {hasUsername ? (
            <>
              <div className="truncate font-display text-[1.15rem] font-bold tracking-[-0.04em] text-white">@{username}</div>
              <div className="truncate text-sm text-on-surface-variant">
                {normalizedWallet ? `${normalizedWallet.slice(0, 6)}...${normalizedWallet.slice(-4)}` : "Pending wallet signature"}
              </div>
            </>
          ) : (
            <>
              <div className="h-6 w-32 rounded-md bg-surface-container-highest motion-safe:animate-pulse" />
              <div className="h-4 w-24 rounded-md bg-surface-container-highest/50 motion-safe:animate-pulse" />
            </>
          )}
        </div>

        <div className="text-right">
          <div className="font-display text-[10px] font-bold uppercase tracking-tighter text-zinc-500">Initial Trust</div>
          <div className="font-display text-2xl font-bold text-primary">0.00</div>
        </div>
      </div>

      <div className="mt-8 h-1 overflow-hidden rounded-full bg-surface-container-highest">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: hasUsername ? "38%" : "25%" }}
          transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
          className={cx(
            "h-full rounded-full",
            hasUsername ? "bg-gradient-to-r from-zinc-800 via-zinc-600 to-secondary/45" : "bg-gradient-to-r from-zinc-800 to-zinc-600",
          )}
        />
      </div>
    </div>
  );
}

function AddKolContent({ compact = false }: { compact?: boolean }) {
  const { session } = useWalletSession();
  const usernameId = useId();
  const walletId = useId();
  const [username, setUsername] = useState("");
  const [wallet, setWallet] = useState("");
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const isSubmitting = submission.kind === "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim().replace(/^@+/, "");
    const trimmedWallet = wallet.trim();

    if (!trimmedUsername) {
      setSubmission({
        kind: "error",
        message: "Enter an X username to continue.",
      });
      return;
    }

    if (!session) {
      setSubmission({
        kind: "error",
        message: "Reconnect wallet to continue.",
      });
      return;
    }

    setSubmission({ kind: "loading" });

    try {
      const payload: CreateKolRequest = {
        xUsername: trimmedUsername,
        walletAddress: trimmedWallet ? trimmedWallet : null,
      };

      const response = await fetch("/api/kols", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<CreateKolResponse>(response);

      setUsername(trimmedUsername);
      setWallet(trimmedWallet);
      setSubmission({
        kind: "success",
        message: `@${trimmedUsername} has been added to the registry.`,
      });
    } catch (error) {
      setSubmission({
        kind: "error",
        message: toUserFacingApiError(error, "Unable to submit this KOL right now.", {
          unauthorizedMessage: "Reconnect wallet to continue.",
        }),
      });
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
      className="relative space-y-8"
    >
      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="mb-12">
          <h1
            className={cx(
              "font-display font-extrabold leading-none tracking-[-0.06em] text-white",
              compact ? "text-4xl" : "text-[2.85rem]",
            )}
          >
            REGISTER NEW KOL
          </h1>
          <p className="mt-2 max-w-[26rem] text-base leading-7 text-on-surface-variant">
            Onboard a key opinion leader to the decentralized reputation registry.
          </p>
        </div>

        <div className="space-y-6">
          <Field
            id={usernameId}
            label="X (Twitter) Username"
            placeholder="elonmusk"
            value={username}
            onChange={(value) => {
              setUsername(value);
              if (submission.kind !== "idle") {
                setSubmission({ kind: "idle" });
              }
            }}
            accent="secondary"
            prefix="@"
            displayFont
            disabled={isSubmitting}
          />

          <Field
            id={walletId}
            label="Wallet Address (Optional)"
            placeholder="0x..."
            value={wallet}
            onChange={(value) => {
              setWallet(value);
              if (submission.kind !== "idle") {
                setSubmission({ kind: "idle" });
              }
            }}
            disabled={isSubmitting}
          />
        </div>

        <div className="mt-12">
          <div className="mb-4 ml-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Registry Preview
          </div>
          <RegistryPreview username={username} wallet={wallet} compact={compact} />
        </div>

        <WalletGate
          className="pt-8"
          title="Connect wallet to continue"
          message="Connect your wallet to submit this KOL to the live registry."
          cardClassName="max-w-[22rem] rounded-[1.6rem] border border-white/8 bg-surface-container-high/95 px-5 py-5"
        >
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cx(
                "w-full rounded-full bg-[linear-gradient(135deg,#00cffc_0%,#00677f_100%)] px-6 py-5 font-display text-lg font-bold tracking-tight text-on-background shadow-[0px_8px_24px_rgba(0,207,252,0.3)] transition-all duration-200",
                isSubmitting
                  ? "cursor-wait opacity-85"
                  : "hover:-translate-y-0.5 active:scale-[0.985]",
              )}
            >
              {submission.kind === "loading"
                ? "SUBMITTING..."
                : submission.kind === "success"
                  ? "REGISTERED"
                  : "SUBMIT TO REGISTRY"}
            </button>

            <div aria-live="polite" className="min-h-6 pt-4 text-center">
              {submission.kind === "success" ? (
                <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary">
                  {submission.message}
                </p>
              ) : null}

              {submission.kind === "error" ? (
                <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.18em] text-tertiary">
                  {submission.message}
                </p>
              ) : null}
            </div>

            <p className="mt-2 text-center font-display text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              Transaction Gas Fees Apply
            </p>
          </div>
        </WalletGate>
      </form>
    </motion.section>
  );
}

export function AddKolScreen() {
  return (
    <>
      <MobileShell navKey="add" avatar={brandAvatar}>
        <div className="relative mx-auto max-w-2xl px-1">
          <div className="pointer-events-none absolute left-[-3rem] top-48 h-40 w-40 rounded-full bg-secondary/6 blur-[90px]" />
          <div className="pointer-events-none absolute right-[-4rem] top-[28rem] h-48 w-40 rounded-full bg-secondary/5 blur-[100px]" />
          <AddKolContent compact />
        </div>
      </MobileShell>

      <DesktopShell
        navKey="add"
        avatar={brandAvatar}
        topbarIcons={["settings"]}
        className="overflow-y-auto thin-scrollbar"
        railButtonVariant="ghost"
      >
        <div className="relative">
          <div className="pointer-events-none absolute left-12 top-16 h-48 w-48 rounded-full bg-secondary/5 blur-[110px]" />
          <div className="pointer-events-none absolute right-0 top-32 h-64 w-64 rounded-full bg-secondary/4 blur-[130px]" />

          <div className="mx-auto max-w-[34rem] py-6">
            <AddKolContent />
          </div>
        </div>
      </DesktopShell>
    </>
  );
}
