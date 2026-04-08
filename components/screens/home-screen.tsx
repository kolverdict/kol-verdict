"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { WalletGate } from "@/components/wallet-gate";
import { Icon, ImageCard, Pill } from "@/components/ui";
import { useWalletSession } from "@/components/wallet-session-provider";
import { parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import { brandAvatar } from "@/lib/mock-data";
import type { HomeResponse, VoteRequest, VoteResponse } from "@/lib/types/api";
import type { HomeCardView } from "@/lib/types/domain";
import { clamp, cx } from "@/lib/utils";

type SwipeDirection = "trust" | "scam";
type VoteDirection = "love" | "hate";
type FeedbackTone = "primary" | "secondary" | "tertiary";
type HomeLoadState = "loading" | "ready" | "empty" | "error" | "exhausted";
type PendingVote = { slug: string; direction: SwipeDirection };
type VerdictCardLayout = "mobile" | "desktop";

const VERDICT_ACK_MS = 180;
const CARD_EXIT_MS = 280;
const FEEDBACK_TIMEOUT_MS = 1800;
const MAX_QUEUE_LENGTH = 500;

function toVoteDirection(direction: SwipeDirection): VoteDirection {
  return direction === "trust" ? "love" : "hate";
}

function voteTag(direction: SwipeDirection) {
  return direction === "trust" ? "Trust" : "Scam";
}

function feedbackTone(direction: SwipeDirection): FeedbackTone {
  return direction === "trust" ? "primary" : "tertiary";
}

function homeStatusCopy(state: Exclude<HomeLoadState, "ready">) {
  if (state === "loading") {
    return {
      title: "Preparing Verdict Queue",
      message: "Syncing the next KOLs from the registry.",
      eyebrow: "Registry Sync",
    };
  }

  if (state === "empty") {
    return {
      title: "No KOLs Ready",
      message: "No active KOLs are available for review right now.",
      eyebrow: "Queue Empty",
    };
  }

  if (state === "exhausted") {
    return {
      title: "No More KOLs to Review",
      message: "You have completed this verdict queue for the current session.",
      eyebrow: "Queue Complete",
    };
  }

  return {
    title: "Verdict Queue Unavailable",
    message: "The next KOLs could not be loaded right now.",
    eyebrow: "Sync Failed",
  };
}

function buildSessionQueue(cards: HomeCardView[]) {
  const uniqueCards: HomeCardView[] = [];
  const seen = new Set<string>();

  cards.forEach((card) => {
    if (seen.has(card.slug)) {
      return;
    }

    seen.add(card.slug);
    uniqueCards.push(card);
  });

  return uniqueCards;
}

function getNextQueueIndex(
  queue: HomeCardView[],
  startIndex: number,
  reviewedSlugs: Record<string, boolean>,
) {
  for (let pointer = startIndex; pointer < queue.length; pointer += 1) {
    if (!reviewedSlugs[queue[pointer]?.slug]) {
      return pointer;
    }
  }

  return queue.length;
}

function feedbackColorClass(tone?: FeedbackTone | null) {
  if (tone === "primary") return "text-primary";
  if (tone === "secondary") return "text-secondary";
  if (tone === "tertiary") return "text-tertiary";
  return "text-on-surface-variant/50";
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "KV";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function QueueImagePreload({ card }: { card: HomeCardView | null }) {
  if (!card?.image) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
      <ImageCard src={card.image} alt={card.handle} priority={false} sizes="1px" className="h-px w-px" />
    </div>
  );
}

function VerdictProgress({
  reviewed,
  total,
  layout,
}: {
  reviewed: number;
  total: number;
  layout: VerdictCardLayout;
}) {
  const safeTotal = Math.max(total, 1);
  const progress = Math.max(0, Math.min(100, Math.round((reviewed / safeTotal) * 100)));
  const isDesktop = layout === "desktop";

  return (
    <div
      className={cx(
        "rounded-[1.5rem] border border-white/6 bg-black/18 px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.24)] backdrop-blur-md",
        isDesktop ? "mx-auto w-full max-w-[48rem]" : "w-full",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[0.52rem] font-black uppercase tracking-[0.24em] text-on-surface-variant/70">
          Verdict Queue
        </span>
        <span className="font-display text-[0.58rem] font-bold uppercase tracking-[0.22em] text-secondary">
          {reviewed} / {total} reviewed
        </span>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(0,207,252,0.75),rgba(156,255,147,0.95))]"
        />
      </div>
    </div>
  );
}

function VerdictActionButton({
  label,
  icon,
  tone,
  disabled,
  active,
  layout,
  onClick,
}: {
  label: string;
  icon: string;
  tone: "primary" | "tertiary";
  disabled: boolean;
  active: boolean;
  layout: VerdictCardLayout;
  onClick: () => void;
}) {
  const isPrimary = tone === "primary";
  const sizeClasses =
    layout === "desktop"
      ? "h-[4.9rem] rounded-[1.55rem] text-[0.78rem] tracking-[0.22em]"
      : "h-[4.35rem] rounded-[1.35rem] text-[0.72rem] tracking-[0.2em]";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      animate={{
        scale: active ? 0.985 : 1,
      }}
      className={cx(
        "relative flex w-full items-center justify-center gap-2 overflow-hidden border font-display font-black uppercase text-center transition-transform duration-200 disabled:cursor-wait disabled:opacity-70",
        sizeClasses,
        isPrimary
          ? "liquid-neon-primary primary-glow border-primary/25 text-on-primary"
          : "border-tertiary/26 bg-[linear-gradient(180deg,rgba(255,77,109,0.18),rgba(255,77,109,0.08))] text-tertiary shadow-[0_18px_36px_rgba(255,77,109,0.12)]",
        active && (isPrimary ? "shadow-[0_0_36px_rgba(156,255,147,0.3)]" : "shadow-[0_0_36px_rgba(255,77,109,0.22)]"),
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_60%)]" />
      <Icon
        name={icon}
        filled={isPrimary}
        className={cx(layout === "desktop" ? "text-[1.55rem]" : "text-[1.35rem]")}
      />
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

function VerdictCard({
  card,
  layout,
  direction,
  pendingDirection,
  voteLocked,
  feedback,
  onReject,
  onEndorse,
}: {
  card: HomeCardView;
  layout: VerdictCardLayout;
  direction: SwipeDirection | null;
  pendingDirection: SwipeDirection | null;
  voteLocked: boolean;
  feedback: { text: string; tone: FeedbackTone } | null;
  onReject: () => void;
  onEndorse: () => void;
}) {
  const isDesktop = layout === "desktop";
  const initials = getInitials(card.name);
  const imageSize = isDesktop ? "h-52 w-52 rounded-[2.15rem]" : "h-40 w-40 rounded-[1.75rem]";
  const containerClasses = isDesktop
    ? "mx-auto w-full max-w-[48rem] rounded-[2.55rem] border border-white/6 px-10 pb-7 pt-6"
    : "w-full rounded-[2.25rem] border border-white/7 px-5 pb-5 pt-5";
  const cardHeight = isDesktop ? "min-h-[38rem]" : "min-h-[calc(100vh-16rem)]";
  const feedbackText = feedback?.text ?? "";

  return (
    <div
      className={cx(
        "relative overflow-hidden bg-surface-container-high shadow-[0_36px_80px_rgba(0,0,0,0.54)]",
        containerClasses,
        cardHeight,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(0,207,252,0.12),transparent_28%),radial-gradient(circle_at_50%_74%,rgba(156,255,147,0.09),transparent_34%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{
          opacity: direction === "trust" ? 0.8 : direction === "scam" ? 0.75 : 0,
          scale: direction ? 1 : 0.94,
        }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className={cx(
          "pointer-events-none absolute inset-0",
          direction === "trust"
            ? "bg-[radial-gradient(circle_at_50%_44%,rgba(156,255,147,0.24),transparent_44%)]"
            : "bg-[radial-gradient(circle_at_50%_44%,rgba(255,77,109,0.2),transparent_44%)]",
        )}
      />
      <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_62%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex justify-center">
          <Pill
            tone={card.reputation >= 70 ? "primary" : "secondary"}
            className="border-white/10 bg-black/25 px-3.5 py-1.5 text-[0.54rem] text-white backdrop-blur-md"
          >
            <span
              className={cx(
                "h-2 w-2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.6)]",
                card.reputation >= 70 ? "bg-primary" : "bg-secondary",
              )}
            />
            {card.verification}
          </Pill>
        </div>

        <div className={cx("relative mx-auto mt-4", isDesktop ? "mb-5" : "mb-4")}>
          <div className={cx("absolute inset-0 rounded-[2.35rem] blur-[40px]", card.reputation >= 70 ? "bg-primary/18" : "bg-secondary/16")} />
          <div className={cx("relative overflow-hidden border border-white/8 bg-surface-container-highest shadow-[0_18px_40px_rgba(0,0,0,0.32)]", imageSize)}>
            <ImageCard
              src={card.image}
              alt={card.name}
              priority
              sizes={isDesktop ? "320px" : "240px"}
              className="h-full w-full"
              imageClassName="object-cover object-center grayscale-[10%] contrast-110"
            />
            {!card.image ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cx(
                    "font-display font-black uppercase tracking-[-0.08em] text-white/88",
                    isDesktop ? "text-[4.2rem]" : "text-[3rem]",
                  )}
                >
                  {initials}
                </span>
              </div>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-transparent" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[30rem] text-center">
          <h1
            className={cx(
              "font-display font-black leading-[0.92] tracking-[-0.08em] text-white",
              isDesktop ? "text-[4.35rem]" : "text-[2.8rem]",
            )}
          >
            {card.name}
          </h1>
          <p className={cx("mt-1 font-display font-bold uppercase tracking-[0.19em] text-secondary", isDesktop ? "text-[0.78rem]" : "text-[0.64rem]")}>
            {card.handle}
          </p>
          <div
            className={cx(
              "mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-on-surface-variant/70",
              isDesktop ? "text-[0.74rem]" : "text-[0.62rem]",
            )}
          >
            <span className="font-medium">{card.role}</span>
            <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
            <span className="font-medium">{card.globalRank}</span>
            <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
            <span className="font-medium">Active</span>
          </div>

          <div className="mx-auto mt-4 w-fit rounded-[1.35rem] border border-primary/20 bg-black/28 px-5 py-3 shadow-[0_0_28px_rgba(156,255,147,0.12)]">
            <div className="font-display text-[0.54rem] font-black uppercase tracking-[0.24em] text-primary/80">
              Verdict Score
            </div>
            <div className="mt-1.5 flex items-end justify-center gap-1">
              <span className={cx("font-display font-black leading-none tracking-[-0.08em] text-primary", isDesktop ? "text-[4.15rem]" : "text-[3.15rem]")}>
                {card.reputation}
              </span>
              <span className={cx("font-display font-bold uppercase tracking-[0.16em] text-on-surface-variant", isDesktop ? "pb-1.5 text-[0.78rem]" : "pb-1 text-[0.68rem]")}>/100</span>
            </div>
          </div>

          <p
            className={cx(
              "mx-auto mt-3 max-w-[30rem] text-on-surface-variant",
              isDesktop ? "text-[0.96rem] leading-7" : "text-[0.88rem] leading-6",
            )}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {card.bio}
          </p>
        </div>

        <div className={cx("mt-4 rounded-[1.55rem] border border-white/7 bg-black/18 text-center", isDesktop ? "px-7 py-5" : "px-4 py-4")}>
          <div className="font-display text-[0.54rem] font-black uppercase tracking-[0.24em] text-on-surface-variant/75">
            Verdict Prompt
          </div>
          <p
            className={cx(
              "mt-2 font-display font-black leading-[0.95] tracking-[-0.06em] text-white",
              isDesktop ? "text-[2.35rem]" : "text-[1.82rem]",
            )}
          >
            Is this KOL trustworthy?
          </p>
        </div>

        <div className="mt-4">
          <WalletGate
            title="Connect wallet to continue"
            message="Connect your wallet to submit a live verdict."
            className="w-full"
            contentClassName="w-full"
            cardClassName={cx(
              "rounded-[1.6rem] border-white/8 bg-surface-container-high/95",
              isDesktop ? "max-w-[16rem] px-5 py-[1.125rem]" : "max-w-[14rem] px-4 py-3.5",
            )}
          >
            <div className="grid grid-cols-2 gap-3">
              <VerdictActionButton
                label="Reject"
                icon="close"
                tone="tertiary"
                layout={layout}
                disabled={voteLocked}
                active={pendingDirection === "scam"}
                onClick={onReject}
              />
              <VerdictActionButton
                label="Endorse"
                icon="favorite"
                tone="primary"
                layout={layout}
                disabled={voteLocked}
                active={pendingDirection === "trust"}
                onClick={onEndorse}
              />
            </div>
          </WalletGate>

          <div
            aria-live="polite"
            className={cx(
              "mt-3 min-h-[1rem] text-center font-display text-[0.56rem] font-bold uppercase tracking-[0.22em]",
              feedbackColorClass(feedback?.tone),
            )}
          >
            {feedbackText}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerdictLoadingState({ layout }: { layout: VerdictCardLayout }) {
  const isDesktop = layout === "desktop";

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2.45rem] border border-white/7 bg-surface-container-high shadow-[0_36px_80px_rgba(0,0,0,0.54)]",
        isDesktop ? "mx-auto w-full max-w-[48rem] px-10 pb-8 pt-7" : "w-full px-5 pb-5 pt-5",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(0,207,252,0.12),transparent_28%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="h-8 w-36 rounded-full bg-white/10 motion-safe:animate-pulse" />
        <div className={cx("mt-5 rounded-[2.1rem] bg-white/6 motion-safe:animate-pulse", isDesktop ? "h-52 w-52" : "h-40 w-40")} />
        <div className="mt-5 h-4 w-28 rounded-full bg-white/10 motion-safe:animate-pulse" />
        <div className={cx("mt-4 h-12 rounded-full bg-white/10 motion-safe:animate-pulse", isDesktop ? "w-80" : "w-56")} />
        <div className={cx("mt-4 h-24 rounded-[1.35rem] border border-white/6 bg-black/20 px-6 py-4 motion-safe:animate-pulse", isDesktop ? "w-52" : "w-44")} />
        <div className={cx("mt-4 h-[4.5rem] rounded-[1.55rem] border border-white/6 bg-black/16 motion-safe:animate-pulse", isDesktop ? "w-[34rem]" : "w-full")} />
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <div className={cx("rounded-[1.35rem] bg-white/8 motion-safe:animate-pulse", isDesktop ? "h-[4.9rem]" : "h-[4.35rem]")} />
          <div className={cx("rounded-[1.35rem] bg-white/10 motion-safe:animate-pulse", isDesktop ? "h-[4.9rem]" : "h-[4.35rem]")} />
        </div>
      </div>
    </div>
  );
}

function VerdictQueueEmptyState({
  state,
  layout,
  onRetry,
}: {
  state: Exclude<HomeLoadState, "ready" | "loading">;
  layout: VerdictCardLayout;
  onRetry: () => void;
}) {
  const isDesktop = layout === "desktop";
  const copy = homeStatusCopy(state);
  const showLeaderboard = state === "exhausted";
  const showAddKol = state === "exhausted" || state === "empty";
  const retryLabel = state === "exhausted" ? "Refresh Queue" : "Retry Queue";

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2.45rem] border border-white/7 bg-surface-container-high shadow-[0_36px_80px_rgba(0,0,0,0.54)]",
        isDesktop ? "mx-auto w-full max-w-[48rem] px-10 pb-9 pt-7" : "w-full px-5 pb-6 pt-5",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(0,207,252,0.12),transparent_28%),radial-gradient(circle_at_50%_78%,rgba(156,255,147,0.09),transparent_34%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <Pill tone="secondary" className="bg-black/25 px-4 py-2 text-[0.56rem] text-white backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(0,207,252,0.7)]" />
          {copy.eyebrow}
        </Pill>

        <div className={cx("relative mt-8 flex items-center justify-center rounded-[2.3rem] border border-white/8 bg-surface-container-highest/70", isDesktop ? "h-52 w-52" : "h-40 w-40")}>
          <div className="absolute inset-0 rounded-[2.3rem] bg-[radial-gradient(circle_at_center,rgba(0,207,252,0.18),transparent_55%)]" />
          <Icon name={state === "error" ? "warning" : "check_circle"} className={cx("relative z-10 text-secondary", isDesktop ? "text-[5rem]" : "text-[4rem]")} />
        </div>

        <h2 className={cx("mt-8 font-display font-black leading-[0.92] tracking-[-0.08em] text-white", isDesktop ? "text-[4rem]" : "text-[2.85rem]")}>
          {copy.title}
        </h2>
        <p className={cx("mt-4 max-w-[30rem] text-on-surface-variant", isDesktop ? "text-lg leading-8" : "text-sm leading-7")}>
          {copy.message}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-secondary/20 bg-secondary/10 px-5 py-3 font-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 hover:bg-secondary/16"
          >
            {retryLabel}
          </button>

          {showLeaderboard ? (
            <Link
              href="/leaderboard"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-on-surface transition-colors duration-300 hover:bg-white/8"
            >
              Leaderboard
            </Link>
          ) : null}

          {showAddKol ? (
            <Link
              href="/add"
              className="rounded-full border border-primary/20 bg-primary/10 px-5 py-3 font-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary transition-colors duration-300 hover:bg-primary/16"
            >
              Add KOL
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DesktopVerdictSurface({
  activeCard,
  direction,
  voteLocked,
  pendingVote,
  feedback,
  nextCard,
  session,
  isTransitioning,
  reviewedCount,
  totalCount,
  onVote,
}: {
  activeCard: HomeCardView;
  direction: SwipeDirection | null;
  voteLocked: boolean;
  pendingVote: PendingVote | null;
  feedback: { text: string; tone: FeedbackTone } | null;
  nextCard: HomeCardView | null;
  session: unknown;
  isTransitioning: boolean;
  reviewedCount: number;
  totalCount: number;
  onVote: (card: HomeCardView, next: SwipeDirection) => Promise<void>;
}) {
  return (
    <div className="relative flex w-full max-w-[48rem] flex-col gap-4">
      <VerdictProgress reviewed={reviewedCount} total={totalCount} layout="desktop" />
      <AnimatePresence mode="wait" initial={false}>
        {!isTransitioning ? (
          <motion.div
            key={activeCard.slug}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={
              direction === "scam"
                ? { opacity: 0, x: [0, -10, 8, -18, -84], y: -6, scale: 0.98 }
                : { opacity: 0, x: 84, y: -8, scale: 0.985 }
            }
            transition={{ duration: CARD_EXIT_MS / 1000, ease: [0.2, 0, 0, 1] }}
          >
            <VerdictCard
              card={activeCard}
              layout="desktop"
              direction={direction}
              pendingDirection={pendingVote?.slug === activeCard.slug ? pendingVote.direction : null}
              voteLocked={voteLocked}
              feedback={feedback}
              onReject={() => void onVote(activeCard, "scam")}
              onEndorse={() => void onVote(activeCard, "trust")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!session ? null : <QueueImagePreload card={nextCard} />}
    </div>
  );
}

function MobileVerdictSurface({
  activeCard,
  direction,
  voteLocked,
  pendingVote,
  feedback,
  nextCard,
  session,
  isTransitioning,
  reviewedCount,
  totalCount,
  onVote,
}: {
  activeCard: HomeCardView;
  direction: SwipeDirection | null;
  voteLocked: boolean;
  pendingVote: PendingVote | null;
  feedback: { text: string; tone: FeedbackTone } | null;
  nextCard: HomeCardView | null;
  session: unknown;
  isTransitioning: boolean;
  reviewedCount: number;
  totalCount: number;
  onVote: (card: HomeCardView, next: SwipeDirection) => Promise<void>;
}) {
  return (
    <div className="relative flex w-full max-w-[22.5rem] flex-col gap-3">
      <VerdictProgress reviewed={reviewedCount} total={totalCount} layout="mobile" />
      <AnimatePresence mode="wait" initial={false}>
        {!isTransitioning ? (
          <motion.div
            key={activeCard.slug}
            drag={session && !voteLocked ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (!session || voteLocked) {
                return;
              }

              const offset = clamp(info.offset.x, -280, 280);
              if (offset > 115) {
                void onVote(activeCard, "trust");
              } else if (offset < -115) {
                void onVote(activeCard, "scam");
              }
            }}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={
              direction === "scam"
                ? { opacity: 0, x: [0, -8, 6, -14, -74], y: -4, scale: 0.98 }
                : { opacity: 0, x: 74, y: -6, scale: 0.985 }
            }
            transition={{ duration: CARD_EXIT_MS / 1000, ease: [0.2, 0, 0, 1] }}
          >
            <VerdictCard
              card={activeCard}
              layout="mobile"
              direction={direction}
              pendingDirection={pendingVote?.slug === activeCard.slug ? pendingVote.direction : null}
              voteLocked={voteLocked}
              feedback={feedback}
              onReject={() => void onVote(activeCard, "scam")}
              onEndorse={() => void onVote(activeCard, "trust")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!session ? null : <QueueImagePreload card={nextCard} />}
    </div>
  );
}

export function HomeScreen() {
  const { session } = useWalletSession();
  const [queue, setQueue] = useState<HomeCardView[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<SwipeDirection | null>(null);
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(null);
  const [reviewedSlugs, setReviewedSlugs] = useState<Record<string, boolean>>({});
  const [loadState, setLoadState] = useState<HomeLoadState>("loading");
  const [reloadNonce, setReloadNonce] = useState(0);
  const acknowledgementTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const activeCard = currentIndex < queue.length ? queue[currentIndex] : null;
  const nextCard = currentIndex + 1 < queue.length ? queue[currentIndex + 1] : null;
  const reviewedCount = Math.min(queue.length, Object.keys(reviewedSlugs).length);
  const voteLocked = pendingVote !== null || isAcknowledging || isTransitioning;
  const showQueueSurface = loadState === "ready" && activeCard !== null;

  function clearAcknowledgementTimeout() {
    if (acknowledgementTimeoutRef.current !== null) {
      window.clearTimeout(acknowledgementTimeoutRef.current);
      acknowledgementTimeoutRef.current = null;
    }
  }

  function clearTransitionTimeout() {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }

  function clearFeedbackTimeout() {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadHome() {
      clearAcknowledgementTimeout();
      clearTransitionTimeout();
      clearFeedbackTimeout();
      setLoadState("loading");
      setDirection(null);
      setPendingVote(null);
      setIsAcknowledging(false);
      setIsTransitioning(false);
      setFeedback(null);

      try {
        const cardsResponse = await fetch("/api/kols", { cache: "no-store", signal: controller.signal });
        const cardsPayload = await parseApiResponse<HomeResponse>(cardsResponse);
        const sessionQueue = buildSessionQueue(cardsPayload.cards).slice(0, MAX_QUEUE_LENGTH);

        if (!active) {
          return;
        }

        if (sessionQueue.length === 0) {
          setQueue([]);
          setCurrentIndex(0);
          setReviewedSlugs({});
          setLoadState("empty");
          return;
        }

        setQueue(sessionQueue);
        setCurrentIndex(0);
        setReviewedSlugs({});
        setLoadState("ready");
      } catch {
        if (active) {
          setQueue([]);
          setCurrentIndex(0);
          setReviewedSlugs({});
          setLoadState("error");
        }
      }
    }

    void loadHome();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadNonce]);

  useEffect(() => {
    return () => {
      clearAcknowledgementTimeout();
      clearTransitionTimeout();
      clearFeedbackTimeout();
    };
  }, []);

  function setFeedbackMessage(text: string, tone: FeedbackTone) {
    clearFeedbackTimeout();
    setFeedback({ text, tone });
  }

  function setTimedFeedback(text: string, tone: FeedbackTone, duration = FEEDBACK_TIMEOUT_MS) {
    clearFeedbackTimeout();
    setFeedback({ text, tone });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, duration);
  }

  function refreshQueue() {
    clearAcknowledgementTimeout();
    clearTransitionTimeout();
    clearFeedbackTimeout();
    setFeedback(null);
    setReloadNonce((current) => current + 1);
  }

  async function submitVote(card: HomeCardView, next: SwipeDirection) {
    if (!card || voteLocked || reviewedSlugs[card.slug]) {
      if (card && reviewedSlugs[card.slug]) {
        setTimedFeedback("Verdict recorded", "secondary");
      }
      return;
    }

    if (!session) {
      setTimedFeedback("Connect wallet to give a verdict.", "secondary");
      return;
    }

    clearAcknowledgementTimeout();
    clearTransitionTimeout();
    clearFeedbackTimeout();
    setPendingVote({ slug: card.slug, direction: next });

    try {
      const payload: VoteRequest = {
        direction: toVoteDirection(next),
        tag: voteTag(next),
      };

      const response = await fetch(`/api/kols/${card.slug}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<VoteResponse>(response);

      const nextReviewedSlugs = {
        ...reviewedSlugs,
        [card.slug]: true,
      };
      const nextIndex = getNextQueueIndex(queue, currentIndex + 1, nextReviewedSlugs);
      const successMessage = next === "trust" ? "Endorsed" : next === "scam" ? "Rejected" : "Verdict recorded";

      setReviewedSlugs(nextReviewedSlugs);
      setDirection(next);
      setIsAcknowledging(true);
      setFeedbackMessage(successMessage, feedbackTone(next));

      acknowledgementTimeoutRef.current = window.setTimeout(() => {
        setIsAcknowledging(false);
        setIsTransitioning(true);
        acknowledgementTimeoutRef.current = null;

        transitionTimeoutRef.current = window.setTimeout(() => {
          setCurrentIndex(nextIndex);
          setPendingVote(null);
          setIsTransitioning(false);
          setDirection(null);
          setFeedback(null);

          if (nextIndex >= queue.length) {
            setLoadState("exhausted");
          }

          transitionTimeoutRef.current = null;
        }, CARD_EXIT_MS);
      }, VERDICT_ACK_MS);
    } catch (error) {
      clearAcknowledgementTimeout();
      clearTransitionTimeout();
      clearFeedbackTimeout();
      setPendingVote(null);
      setIsAcknowledging(false);
      setDirection(null);
      setIsTransitioning(false);
      setTimedFeedback(
        toUserFacingApiError(error, "Unable to submit verdict.", {
          unauthorizedMessage: "Reconnect wallet to give a verdict.",
        }),
        "tertiary",
      );
    }
  }

  return (
    <>
      <MobileShell navKey="home" avatar={brandAvatar} rightIconTone="secondary">
        <section className="relative flex min-h-[calc(100vh-12rem)] items-center justify-center py-2">
          <div className="absolute inset-x-0 top-14 h-44 rounded-full bg-secondary/8 blur-[100px]" />
          <div className="absolute -left-10 top-1/3 h-72 w-44 rounded-full bg-secondary/8 blur-[120px]" />
          <div className="absolute -right-12 bottom-1/4 h-80 w-52 rounded-full bg-primary/8 blur-[130px]" />

          {showQueueSurface && activeCard ? (
            <MobileVerdictSurface
              activeCard={activeCard}
              direction={direction}
              voteLocked={voteLocked}
              pendingVote={pendingVote}
              feedback={feedback}
              nextCard={nextCard}
              session={session}
              isTransitioning={isTransitioning}
              reviewedCount={reviewedCount}
              totalCount={queue.length}
              onVote={submitVote}
            />
          ) : loadState === "loading" ? (
            <div className="w-full max-w-[22.5rem]">
              <VerdictLoadingState layout="mobile" />
            </div>
          ) : (
            <div className="w-full max-w-[22.5rem]">
              <VerdictQueueEmptyState
                state={loadState === "ready" ? "exhausted" : loadState}
                layout="mobile"
                onRetry={refreshQueue}
              />
            </div>
          )}
        </section>
      </MobileShell>

      <DesktopShell
        navKey="home"
        avatar={brandAvatar}
        searchPlaceholder="Search Oracles..."
        className="relative"
      >
        <section className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden bg-gradient-to-b from-surface via-surface-container-lowest to-surface px-8 pb-10 pt-8">
          <div className="absolute left-6 top-20 h-[22rem] w-[22rem] rounded-full bg-secondary/6 blur-[120px]" />
          <div className="absolute bottom-0 right-14 h-[24rem] w-[24rem] rounded-full bg-primary/6 blur-[130px]" />

          {showQueueSurface && activeCard ? (
            <DesktopVerdictSurface
              activeCard={activeCard}
              direction={direction}
              voteLocked={voteLocked}
              pendingVote={pendingVote}
              feedback={feedback}
              nextCard={nextCard}
              session={session}
              isTransitioning={isTransitioning}
              reviewedCount={reviewedCount}
              totalCount={queue.length}
              onVote={submitVote}
            />
          ) : loadState === "loading" ? (
            <VerdictLoadingState layout="desktop" />
          ) : (
            <VerdictQueueEmptyState
              state={loadState === "ready" ? "exhausted" : loadState}
              layout="desktop"
              onRetry={refreshQueue}
            />
          )}
        </section>
      </DesktopShell>
    </>
  );
}
