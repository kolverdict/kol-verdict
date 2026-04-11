"use client";

import Link from "next/link";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { Icon } from "@/components/ui";
import { brandAvatar, type NavKey } from "@/lib/mock-data";
import { cx } from "@/lib/utils";

type RouteStateScreenProps = {
  navKey: NavKey;
  title: string;
  message: string;
  icon: string;
  tone?: "primary" | "secondary" | "tertiary";
  loading?: boolean;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

function toneClasses(tone: NonNullable<RouteStateScreenProps["tone"]>) {
  if (tone === "primary") {
    return {
      text: "text-primary",
      border: "border-primary/20",
      background: "bg-primary/10",
      glow: "bg-primary/10",
      button: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/16",
    };
  }

  if (tone === "tertiary") {
    return {
      text: "text-tertiary",
      border: "border-tertiary/20",
      background: "bg-tertiary/10",
      glow: "bg-tertiary/10",
      button: "border-tertiary/20 bg-tertiary/10 text-tertiary hover:bg-tertiary/16",
    };
  }

  return {
    text: "text-secondary",
    border: "border-secondary/20",
    background: "bg-secondary/10",
    glow: "bg-secondary/10",
    button: "border-secondary/20 bg-secondary/10 text-secondary hover:bg-secondary/16",
  };
}

function StateAction({
  label,
  href,
  onAction,
  className,
}: {
  label: string;
  href?: string;
  onAction?: () => void;
  className?: string;
}) {
  const content = (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-[1rem] border px-5 py-3 font-display text-[0.66rem] font-bold uppercase tracking-[0.2em] transition-colors duration-300",
        className,
      )}
    >
      {label}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" onClick={onAction}>
      {content}
    </button>
  );
}

function LoadingBars() {
  return (
    <div className="w-full max-w-[18rem] space-y-3">
      <div className="h-3 w-28 rounded-full bg-white/12 motion-safe:animate-pulse" />
      <div className="h-3 w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
      <div className="h-3 w-4/5 rounded-full bg-white/8 motion-safe:animate-pulse" />
    </div>
  );
}

export function RouteStateScreen({
  navKey,
  title,
  message,
  icon,
  tone = "secondary",
  loading = false,
  actionLabel,
  actionHref,
  onAction,
}: RouteStateScreenProps) {
  const toneStyles = toneClasses(tone);

  return (
    <>
      <MobileShell navKey={navKey} avatar={brandAvatar}>
        <section className="relative flex min-h-[calc(100vh-12rem)] items-center justify-center">
          <div className={cx("pointer-events-none absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full blur-[110px]", toneStyles.glow)} />

          <div className="glass-panel relative w-full max-w-[21.5rem] overflow-hidden rounded-[2.4rem] border border-white/6 px-6 py-8 text-center shadow-[0_28px_56px_rgba(0,0,0,0.44)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.02] to-transparent" />
            <div className="relative flex flex-col items-center">
              <div className={cx("mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] border", toneStyles.border, toneStyles.background)}>
                <Icon name={icon} className={cx("text-[2rem]", toneStyles.text)} />
              </div>
              <div className={cx("mb-3 font-display text-[0.58rem] font-bold uppercase tracking-[0.24em]", toneStyles.text)}>
                {loading ? "Syncing Registry" : "Status Update"}
              </div>
              <h1 className="font-display text-[2rem] font-black leading-[0.94] tracking-[-0.08em] text-white">{title}</h1>
              <p className="mt-4 max-w-[17rem] text-sm leading-7 text-on-surface-variant">{message}</p>
              <div className="mt-6">
                {loading ? <LoadingBars /> : actionLabel ? <StateAction label={actionLabel} href={actionHref} onAction={onAction} className={toneStyles.button} /> : null}
              </div>
            </div>
          </div>
        </section>
      </MobileShell>

      <DesktopShell
        navKey={navKey}
        avatar={brandAvatar}
        className="relative"
      >
        <section className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden px-8 pb-8 pt-4">
          <div className={cx("pointer-events-none absolute left-12 top-20 h-[28rem] w-[28rem] rounded-full blur-[130px]", toneStyles.glow)} />
          <div className={cx("pointer-events-none absolute bottom-[-4rem] right-8 h-[26rem] w-[26rem] rounded-full blur-[140px]", toneStyles.glow)} />

          <div className="relative w-full max-w-[62rem] overflow-hidden rounded-[2.5rem] border border-white/5 bg-surface-container-low shadow-[0_28px_56px_rgba(0,0,0,0.54)]">
            <div className="grid min-h-[34rem] grid-cols-[0.92fr_1.08fr]">
              <div className="relative overflow-hidden border-r border-white/5 bg-[linear-gradient(180deg,rgba(12,15,18,0.96),rgba(8,11,13,0.98))]">
                <div className={cx("absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]", toneStyles.glow)} />
                <div className="relative flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
                  <div className={cx("flex h-28 w-28 items-center justify-center rounded-[2rem] border", toneStyles.border, toneStyles.background)}>
                    <Icon name={icon} className={cx("text-[4rem]", toneStyles.text)} />
                  </div>
                  {loading ? (
                    <div className="w-full max-w-[18rem] space-y-4">
                      <div className="mx-auto h-4 w-28 rounded-full bg-white/12 motion-safe:animate-pulse" />
                      <div className="h-4 w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
                      <div className="mx-auto h-4 w-3/4 rounded-full bg-white/8 motion-safe:animate-pulse" />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col justify-center px-12 py-12">
                <div className={cx("mb-3 font-display text-[0.58rem] font-bold uppercase tracking-[0.28em]", toneStyles.text)}>
                  {loading ? "Loading Surface" : "Runtime Status"}
                </div>
                <h1 className="font-display text-[4rem] font-black leading-[0.92] tracking-[-0.08em] text-white">{title}</h1>
                <p className="mt-6 max-w-[28rem] text-[1rem] leading-8 text-on-surface-variant">{message}</p>
                <div className="mt-8">
                  {loading ? (
                    <div className="w-full max-w-[18rem] space-y-3">
                      <div className="h-3 w-24 rounded-full bg-white/12 motion-safe:animate-pulse" />
                      <div className="h-3 w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
                      <div className="h-3 w-4/5 rounded-full bg-white/8 motion-safe:animate-pulse" />
                    </div>
                  ) : actionLabel ? (
                    <StateAction label={actionLabel} href={actionHref} onAction={onAction} className={toneStyles.button} />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </DesktopShell>
    </>
  );
}
