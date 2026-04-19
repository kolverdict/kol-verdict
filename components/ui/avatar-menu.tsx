"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletSession } from "@/components/wallet-session-provider";
import { Icon, ImageCard } from "@/components/ui";
import { cx } from "@/lib/utils";

type AvatarMenuMode = "desktop" | "mobile";
type MenuItemKey = "profile" | "settings" | "sign_out";
type MenuItem = {
  key: MenuItemKey;
  label: string;
  icon: string;
  tone: "default" | "danger";
  disabled?: boolean;
};

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function maskWalletAddress(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function logAvatarMenuDebug(payload: Record<string, unknown>) {
  if (!isDevelopment()) {
    return;
  }

  console.info("[avatar-menu]", payload);
}

function normalizeMenuError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to disconnect right now.";
}

export function AvatarMenu({
  fallbackAvatar,
  mode,
}: {
  fallbackAvatar: string;
  mode: AvatarMenuMode;
}) {
  const router = useRouter();
  const { session, profile, status, signOut } = useWalletSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousOpenRef = useRef(false);
  const authIdentityRef = useRef<string | null>(null);
  const surfaceId = useId();
  const titleId = useId();
  const resolvedAvatar = profile?.avatarUrl ?? session?.avatarUrl ?? fallbackAvatar;
  const busy = submitting || status === "disconnecting";
  const isSignedIn = Boolean(
    session?.profileId ||
      session?.walletAddress ||
      profile?.id ||
      profile?.walletAddress,
  );
  const authIdentity =
    session?.profileId ??
    session?.walletAddress ??
    profile?.id ??
    profile?.walletAddress ??
    null;

  const items: MenuItem[] = [
    {
      key: "profile",
      label: "Profile",
      icon: "account_circle",
      tone: "default",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings",
      tone: "default",
      disabled: true,
    },
    ...(isSignedIn
      ? [
          {
            key: "sign_out" as const,
            label: "Disconnect & Logout",
            icon: "logout",
            tone: "danger" as const,
          },
        ]
      : []),
  ];
  const hasSignOutAction = items.some((item) => item.key === "sign_out");
  const enabledItems = items.filter((item) => !item.disabled);
  const enabledIndexByKey = new Map(enabledItems.map((item, index) => [item.key, index]));

  itemRefs.current.length = enabledItems.length;

  function focusEnabledItem(nextIndex: number) {
    const enabledButtons = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));

    if (enabledButtons.length === 0) {
      return;
    }

    const boundedIndex = Math.max(0, Math.min(enabledButtons.length - 1, nextIndex));
    enabledButtons[boundedIndex]?.focus();
  }

  function closeMenu(options: { restoreFocus?: boolean } = {}) {
    if (busy) {
      return;
    }

    setOpen(false);
    setError(null);

    if (options.restoreFocus !== false) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

  function toggleMenu() {
    if (busy) {
      return;
    }

    setError(null);
    setOpen((current) => !current);
  }

  async function handleItemSelect(key: MenuItemKey) {
    if (busy) {
      return;
    }

    if (key === "profile") {
      setOpen(false);
      setError(null);
      router.push("/profile");
      return;
    }

    if (key === "settings") {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signOut();
      setOpen(false);
      window.location.assign("/");
    } catch (nextError) {
      setError(normalizeMenuError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSurfaceKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    const enabledButtons = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    if (enabledButtons.length === 0) {
      return;
    }

    const currentIndex = enabledButtons.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusEnabledItem(currentIndex >= 0 ? currentIndex + 1 : 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusEnabledItem(currentIndex >= 0 ? currentIndex - 1 : enabledButtons.length - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusEnabledItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusEnabledItem(enabledButtons.length - 1);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (busy) {
        return;
      }

      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (triggerRef.current?.contains(target) || surfaceRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setError(null);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setOpen(false);
      setError(null);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, open]);

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      logAvatarMenuDebug({
        event: "open",
        mode,
        status,
        isSignedIn,
        session: {
          present: Boolean(session),
          profileId: session?.profileId ?? null,
          walletAddress: maskWalletAddress(session?.walletAddress),
          hasWalletAddress: Boolean(session?.walletAddress),
        },
        profile: {
          present: Boolean(profile),
          id: profile?.id ?? null,
          walletAddress: maskWalletAddress(profile?.walletAddress),
          hasWalletAddress: Boolean(profile?.walletAddress),
        },
      });

      window.requestAnimationFrame(() => {
        focusEnabledItem(0);
      });
    }

    if (!open && previousOpenRef.current) {
      setSubmitting(false);
    }

    previousOpenRef.current = open;
  }, [isSignedIn, mode, open, profile, session, status]);

  useEffect(() => {
    logAvatarMenuDebug({
      event: "auth-state",
      mode,
      status,
      isSignedIn,
      session: {
        present: Boolean(session),
        profileId: session?.profileId ?? null,
        walletAddress: maskWalletAddress(session?.walletAddress),
        hasWalletAddress: Boolean(session?.walletAddress),
      },
      profile: {
        present: Boolean(profile),
        id: profile?.id ?? null,
        walletAddress: maskWalletAddress(profile?.walletAddress),
        hasWalletAddress: Boolean(profile?.walletAddress),
      },
    });

    if (authIdentityRef.current === null) {
      authIdentityRef.current = authIdentity;
      return;
    }

    if (open && authIdentityRef.current !== authIdentity) {
      setOpen(false);
      setError(null);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }

    authIdentityRef.current = authIdentity;
  }, [authIdentity, isSignedIn, mode, open, profile, session, status]);

  const triggerClasses =
    mode === "desktop"
      ? "h-10 w-10 rounded-2xl border border-primary/20 bg-surface-container-high hover:border-white/16 hover:bg-surface-container"
      : "h-10 w-10 rounded-2xl border border-white/10 bg-surface-container-high shadow-surface hover:border-white/16";

  function renderItem(item: MenuItem) {
    const enabledIndex = enabledIndexByKey.get(item.key);
    const disabled = Boolean(item.disabled);

    const button = (
      <button
        type="button"
        role={mode === "desktop" ? "menuitem" : undefined}
        disabled={disabled || busy}
        ref={
          disabled || enabledIndex === undefined
            ? undefined
            : (node) => {
                itemRefs.current[enabledIndex] = node;
              }
        }
        onClick={() => void handleItemSelect(item.key)}
        className={cx(
          "kv-focus-ring flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200",
          disabled
            ? "cursor-not-allowed text-on-surface-variant/42"
            : item.tone === "danger"
              ? "text-tertiary hover:bg-tertiary/10 hover:text-tertiary"
              : "text-on-surface-variant hover:bg-white/[0.05] hover:text-on-surface",
          mode === "mobile" ? "min-h-14" : "min-h-11",
        )}
      >
        <span
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-full border",
            disabled
              ? "border-white/8 bg-white/[0.03] text-on-surface-variant/38"
              : item.tone === "danger"
                ? "border-tertiary/18 bg-tertiary/10 text-tertiary"
                : "border-white/10 bg-white/[0.04] text-on-surface-variant",
          )}
        >
          <Icon name={item.icon} className="text-[1.05rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cx(
              "font-label font-semibold uppercase tracking-[0.14em]",
              mode === "mobile" ? "text-[0.68rem]" : "text-[0.62rem]",
            )}
          >
            {item.label}
          </div>
          {item.key === "settings" ? (
            <div className="mt-1 text-[0.72rem] text-on-surface-variant/48">Coming soon</div>
          ) : null}
        </div>
      </button>
    );

    if (item.key === "sign_out") {
      return (
        <div
          key={item.key}
          className={cx(
            "border-white/8",
            hasSignOutAction ? "mt-1 border-t pt-2" : "",
          )}
        >
          {button}
        </div>
      );
    }

    return <div key={item.key}>{button}</div>;
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={mode === "desktop" ? "menu" : "dialog"}
        aria-expanded={open}
        aria-controls={surfaceId}
        onClick={toggleMenu}
        className={cx(
          "kv-focus-ring relative overflow-hidden transition-colors duration-200",
          triggerClasses,
        )}
      >
        <ImageCard
          src={resolvedAvatar}
          alt="Account menu"
          className="h-full w-full"
          sizes="40px"
          fallbackSrc="/default-avatar.svg"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && mode === "desktop" ? (
          <motion.div
            key="desktop-avatar-menu"
            id={surfaceId}
            role="menu"
            aria-orientation="vertical"
            ref={surfaceRef}
            onKeyDown={handleSurfaceKeyDown}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[18rem] rounded-[1.35rem] border border-white/10 bg-surface-container-low/95 p-2 shadow-[0_28px_56px_rgba(0,0,0,0.45)] backdrop-blur-[18px]"
          >
            <div className="px-3 pb-2 pt-1">
              <div className="font-display text-[0.72rem] font-bold uppercase tracking-[0.18em] text-white">
                Account
              </div>
            </div>
            <div className="space-y-0.5">{items.map(renderItem)}</div>
            {error ? (
              <p className="px-3 pb-2 pt-3 text-[0.74rem] leading-5 text-tertiary" role="alert">
                {error}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && mode === "mobile" ? (
          <>
            <motion.button
              key="mobile-avatar-backdrop"
              type="button"
              aria-label="Close account menu"
              disabled={busy}
              onClick={() => closeMenu()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="fixed inset-0 z-[55] bg-black/58 backdrop-blur-[3px]"
            />

            <motion.div
              key="mobile-avatar-sheet"
              id={surfaceId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              ref={surfaceRef}
              onKeyDown={handleSurfaceKeyDown}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className="fixed inset-x-0 bottom-0 z-[60] flex h-auto max-h-[80dvh] flex-col items-stretch justify-start overflow-y-auto rounded-t-[1.8rem] border border-white/10 bg-surface-container-low/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_56px_rgba(0,0,0,0.48)] backdrop-blur-[18px]"
            >
              <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/14" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id={titleId}
                    className="font-display text-[1rem] font-bold uppercase tracking-[0.16em] text-white"
                  >
                    Account
                  </h2>
                  <p className="mt-1 text-[0.8rem] text-on-surface-variant">
                    Manage your session actions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => closeMenu()}
                  disabled={busy}
                  className="kv-focus-ring flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-on-surface-variant transition-colors duration-200 hover:bg-white/[0.05] hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close account menu"
                >
                  <Icon name="close" className="text-[1.35rem]" />
                </button>
              </div>

              <div className="mt-4 space-y-1" role="menu" aria-orientation="vertical">
                {items.map(renderItem)}
              </div>

              {error ? (
                <p className="px-1 pb-1 pt-3 text-[0.82rem] leading-6 text-tertiary" role="alert">
                  {error}
                </p>
              ) : null}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
