"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
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

type AvatarLookupStatus = "idle" | "loading" | "ready" | "error";

const AVATAR_PREVIEW_DEBOUNCE_MS = 320;

function normalizeXUsername(value: string) {
  const trimmed = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(trimmed)) {
    return "";
  }

  return trimmed;
}

function buildAvatarPreviewUrl(username: string) {
  return `https://unavatar.io/x/${username}`;
}

function getInitials(value: string) {
  const cleaned = value.trim().replace(/^@+/, "");
  if (!cleaned) {
    return "??";
  }

  return cleaned.slice(0, 2).toUpperCase();
}

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
          "kv-label mb-2 block",
          accent === "secondary" ? "text-secondary" : "text-on-surface-variant",
        )}
      >
        {label}
      </label>

      <div className="relative overflow-hidden rounded-xl border border-white/8 bg-surface-container-lowest transition-colors focus-within:border-secondary/45">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.25rem] tracking-[-0.04em] text-on-surface-variant">
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
            "kv-focus-ring h-12 w-full bg-transparent px-4 text-base text-on-surface placeholder:text-on-surface-variant/45 disabled:cursor-not-allowed disabled:opacity-60",
            prefix ? "pl-10 pr-4" : "px-4",
            displayFont ? "tracking-[-0.03em]" : "",
          )}
        />
      </div>
    </div>
  );
}

function RegistryPreview({
  username,
  wallet,
  avatarUrl,
  avatarStatus,
  compact = false,
}: {
  username: string;
  wallet: string;
  avatarUrl: string | null;
  avatarStatus: AvatarLookupStatus;
  compact?: boolean;
}) {
  const hasUsername = username.trim().length > 0;
  const normalizedWallet = wallet.trim();
  const initials = getInitials(username);

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.4rem] border border-white/8 bg-surface-container-high shadow-surface",
        compact ? "p-5" : "p-6",
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-secondary/4 blur-[80px]" />

      <div className="relative flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-secondary/20 bg-surface-container-highest">
          {avatarUrl && avatarStatus === "ready" ? (
            <Image
              src={avatarUrl}
              alt={`@${username} avatar preview`}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : hasUsername ? (
            <span className="font-display text-[1.25rem] font-bold uppercase tracking-[-0.08em] text-white">
              {initials}
            </span>
          ) : (
            <Icon name="person" className="text-3xl text-on-surface-variant/45" />
          )}

          {avatarStatus === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/38 backdrop-blur-[2px]">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/80 motion-safe:animate-pulse" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {hasUsername ? (
            <>
              <div className="truncate font-display text-[1.05rem] font-bold tracking-[-0.04em] text-white">@{username}</div>
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
          <div className="font-label text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Initial Trust</div>
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
  const { session, requireWalletForWrite } = useWalletSession();
  const usernameId = useId();
  const walletId = useId();
  const [username, setUsername] = useState("");
  const [wallet, setWallet] = useState("");
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarLookupStatus, setAvatarLookupStatus] = useState<AvatarLookupStatus>("idle");
  const avatarRequestKeyRef = useRef(0);
  const isSubmitting = submission.kind === "loading";
  const normalizedUsername = normalizeXUsername(username);

  function handleUsernameChange(value: string) {
    setUsername(value);

    const nextNormalizedUsername = normalizeXUsername(value);
    avatarRequestKeyRef.current += 1;

    if (!nextNormalizedUsername) {
      setAvatarPreviewUrl(null);
      setAvatarLookupStatus("idle");
    } else {
      setAvatarPreviewUrl(null);
      setAvatarLookupStatus("loading");
    }

    if (submission.kind !== "idle") {
      setSubmission({ kind: "idle" });
    }
  }

  useEffect(() => {
    if (!normalizedUsername) {
      return;
    }

    const requestKey = avatarRequestKeyRef.current;

    const timeoutId = window.setTimeout(() => {
      const previewUrl = buildAvatarPreviewUrl(normalizedUsername);
      const image = new window.Image();

      image.onload = () => {
        if (avatarRequestKeyRef.current !== requestKey) {
          return;
        }

        setAvatarPreviewUrl(previewUrl);
        setAvatarLookupStatus("ready");
      };

      image.onerror = () => {
        if (avatarRequestKeyRef.current !== requestKey) {
          return;
        }

        setAvatarPreviewUrl(null);
        setAvatarLookupStatus("error");
      };

      image.src = previewUrl;
    }, AVATAR_PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [normalizedUsername]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = normalizeXUsername(username);
    const trimmedWallet = wallet.trim();

    if (!trimmedUsername) {
      setSubmission({
        kind: "error",
        message: "Enter an X username to continue.",
      });
      return;
    }

    if (!session) {
      const granted = await requireWalletForWrite({
        title: "Connect wallet to continue",
        message: "Connect your wallet to submit this KOL to the live registry.",
        cardClassName: "max-w-[22rem] rounded-[1.6rem] border border-white/8 bg-surface-container-high/95 px-5 py-5",
      });

      if (!granted) {
        return;
      }
    }

    setSubmission({ kind: "loading" });

    try {
      const payload: CreateKolRequest = {
        xUsername: trimmedUsername,
        walletAddress: trimmedWallet ? trimmedWallet : null,
        avatarUrl: avatarLookupStatus === "ready" ? avatarPreviewUrl : null,
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
      className="relative"
    >
      <form className={cx("grid gap-6", compact ? "grid-cols-1" : "md:grid-cols-[0.92fr_1.08fr]")} onSubmit={handleSubmit}>
        <div className={cx("space-y-6", compact ? "" : "rounded-[1.5rem] border border-white/8 bg-surface-container-low p-6 shadow-surface")}>
          <div>
            <div className="kv-label mb-2 text-secondary">Registry Entry</div>
            <h1
              className={cx(
                "font-display font-bold leading-none tracking-[-0.045em] text-white [word-spacing:0.08em]",
                compact ? "text-[2.35rem]" : "text-[2.75rem]",
              )}
            >
              REGISTER NEW KOL
            </h1>
            <p className="mt-3 max-w-[28rem] text-sm leading-6 text-on-surface-variant">
              Add an X profile to the live reputation registry. Wallet address is optional.
            </p>
          </div>

          <div className="space-y-5">
            <Field
              id={usernameId}
              label="X (Twitter) Username"
              placeholder="elonmusk"
              value={username}
              onChange={handleUsernameChange}
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

          <div className={cx("pt-2", compact ? "hidden" : "")}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cx(
                "kv-focus-ring w-full rounded-xl border border-secondary/25 bg-secondary/14 px-6 py-4 font-label text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-secondary transition-[background-color,transform,opacity] duration-200",
                isSubmitting ? "cursor-wait opacity-85" : "hover:-translate-y-0.5 hover:bg-secondary/20 active:scale-[0.985]",
              )}
            >
              {submission.kind === "loading"
                ? "Submitting..."
                : submission.kind === "success"
                  ? "Registered"
                  : "Submit to Registry"}
            </button>
          </div>
        </div>

        <div className={cx("space-y-4", compact ? "" : "rounded-[1.5rem] border border-white/8 bg-surface-container-low p-6 shadow-surface")}>
          <div className="kv-label text-on-surface-variant">
            Registry Preview
          </div>
          <RegistryPreview
            username={normalizedUsername}
            wallet={wallet}
            avatarUrl={avatarPreviewUrl}
            avatarStatus={avatarLookupStatus}
            compact={compact}
          />

          <p className="text-sm leading-6 text-on-surface-variant">
            Public profile, community verdicts, and evidence links will be attached to this registry record.
          </p>

          <div className={cx("pt-2", compact ? "" : "hidden")}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cx(
                "kv-focus-ring w-full rounded-xl border border-secondary/25 bg-secondary/14 px-6 py-4 font-label text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-secondary transition-[background-color,transform,opacity] duration-200",
                isSubmitting ? "cursor-wait opacity-85" : "hover:-translate-y-0.5 hover:bg-secondary/20 active:scale-[0.985]",
              )}
            >
              {submission.kind === "loading"
                ? "Submitting..."
                : submission.kind === "success"
                  ? "Registered"
                  : "Submit to Registry"}
            </button>
          </div>

          <div aria-live="polite" className="min-h-6 pt-4 text-center">
            {submission.kind === "success" ? (
              <p className="font-label text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
                {submission.message}
              </p>
            ) : null}

            {submission.kind === "error" ? (
              <p className="font-label text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-tertiary">
                {submission.message}
              </p>
            ) : null}
          </div>

          <p className="text-center font-label text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/55">
            Transaction Gas Fees Apply
          </p>
        </div>
      </form>
    </motion.section>
  );
}

export function AddKolScreen() {
  return (
    <>
      <MobileShell navKey="add" avatar={brandAvatar}>
        <div className="relative mx-auto max-w-[26rem] px-0">
          <div className="pointer-events-none absolute right-[-4rem] top-28 h-40 w-40 rounded-full bg-secondary/5 blur-[90px]" />
          <AddKolContent compact />
        </div>
      </MobileShell>

      <DesktopShell
        navKey="add"
        avatar={brandAvatar}
        className="overflow-y-auto thin-scrollbar"
        railButtonVariant="ghost"
      >
        <div className="relative">
          <div className="pointer-events-none absolute left-20 top-10 h-48 w-48 rounded-full bg-secondary/4 blur-[110px]" />

          <div className="kv-page-tight">
            <AddKolContent />
          </div>
        </div>
      </DesktopShell>
    </>
  );
}
