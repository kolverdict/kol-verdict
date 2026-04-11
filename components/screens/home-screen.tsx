"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { KolDetailCard } from "@/components/kols/kol-detail-card";
import { Icon, ImageCard, Pill } from "@/components/ui";
import { useWalletSession } from "@/components/wallet-session-provider";
import { ApiClientError, parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import { brandAvatar } from "@/lib/mock-data";
import type { HomeResponse, KolProfileDetail, KolProfileDetailResponse, VoteRequest, VoteResponse } from "@/lib/types/api";
import type { HomeCardView } from "@/lib/types/domain";
import { clamp, cx } from "@/lib/utils";

type SwipeDirection = "trust" | "scam";
type VoteDirection = "love" | "hate";
type BrowseDirection = "previous" | "next";
type CardTransitionDirection = SwipeDirection | BrowseDirection;
type FeedbackTone = "primary" | "secondary" | "tertiary";
type HomeLoadState = "loading" | "ready" | "empty" | "error" | "exhausted";
type PendingVote = { slug: string; direction: SwipeDirection };
type VerdictCardLayout = "mobile" | "desktop";
type KolIntelligenceState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      profile: KolProfileDetail;
    }
  | {
      status: "not_found";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

const VERDICT_ACK_MS = 180;
const CARD_EXIT_MS = 280;
const FEEDBACK_TIMEOUT_MS = 1800;
const MAX_QUEUE_LENGTH = 500;
const BROWSE_SWIPE_THRESHOLD_PX = 115;
const MAX_BROWSE_SWIPE_OFFSET_PX = 280;
const HOME_QUEUE_SESSION_KEY = "kolverdict.home.queue.order";

function toVoteDirection(direction: SwipeDirection): VoteDirection {
  return direction === "trust" ? "love" : "hate";
}

function voteTag(direction: SwipeDirection) {
  return direction === "trust" ? "Trust" : "Scam";
}

function feedbackTone(direction: SwipeDirection): FeedbackTone {
  return direction === "trust" ? "primary" : "tertiary";
}

function exitsLeft(direction: CardTransitionDirection | null) {
  return direction === "scam" || direction === "next";
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

function shuffleArray<T>(array: T[]) {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function persistSessionQueue(cards: HomeCardView[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      HOME_QUEUE_SESSION_KEY,
      JSON.stringify(cards.map((card) => card.slug)),
    );
  } catch {
    // Ignore storage failures and continue with the in-memory queue.
  }
}

function resolveSessionQueue(cards: HomeCardView[]) {
  if (cards.length <= 1 || typeof window === "undefined") {
    return cards;
  }

  try {
    const storedValue = window.sessionStorage.getItem(HOME_QUEUE_SESSION_KEY);

    if (storedValue) {
      const storedSlugs = JSON.parse(storedValue);

      if (Array.isArray(storedSlugs) && storedSlugs.length === cards.length) {
        const cardBySlug = new Map(cards.map((card) => [card.slug, card] as const));
        const storedSlugSet = new Set(storedSlugs.filter((slug): slug is string => typeof slug === "string"));

        if (
          storedSlugSet.size === cards.length &&
          cards.every((card) => storedSlugSet.has(card.slug))
        ) {
          return storedSlugs.map((slug) => cardBySlug.get(slug)).filter((card): card is HomeCardView => Boolean(card));
        }
      }
    }
  } catch {
    // Ignore malformed session data and fall back to a fresh shuffle.
  }

  const shuffledCards = shuffleArray(cards);
  persistSessionQueue(shuffledCards);
  return shuffledCards;
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

function browseDirectionFromOffset(offsetX: number, offsetY: number): BrowseDirection | null {
  const clampedOffsetX = clamp(offsetX, -MAX_BROWSE_SWIPE_OFFSET_PX, MAX_BROWSE_SWIPE_OFFSET_PX);
  const clampedOffsetY = clamp(offsetY, -MAX_BROWSE_SWIPE_OFFSET_PX, MAX_BROWSE_SWIPE_OFFSET_PX);

  if (Math.abs(clampedOffsetX) >= Math.abs(clampedOffsetY)) {
    if (clampedOffsetX > BROWSE_SWIPE_THRESHOLD_PX) {
      return "previous";
    }

    if (clampedOffsetX < -BROWSE_SWIPE_THRESHOLD_PX) {
      return "next";
    }

    return null;
  }

  if (clampedOffsetY > BROWSE_SWIPE_THRESHOLD_PX) {
    return "previous";
  }

  if (clampedOffsetY < -BROWSE_SWIPE_THRESHOLD_PX) {
    return "next";
  }

  return null;
}
function reasonTagToneClasses(tone: HomeCardView["reasonTags"][number]["tone"]) {
  if (tone === "primary") {
    return "border-primary/18 bg-primary/10 text-primary";
  }

  if (tone === "secondary") {
    return "border-secondary/18 bg-secondary/10 text-secondary";
  }

  if (tone === "tertiary") {
    return "border-tertiary/18 bg-tertiary/10 text-tertiary";
  }

  return "border-white/10 bg-white/6 text-on-surface-variant";
}

function resolveSummaryCard(
  card: HomeCardView,
  intelligenceState?: KolIntelligenceState,
) {
  const profile = intelligenceState?.status === "ready" ? intelligenceState.profile : null;
  const reputation = profile?.trustScore ?? card.reputation;
  const verification = profile
    ? profile.verified
      ? reputation >= 90
        ? "Oracle Verified Alpha"
        : "Verified Oracle"
      : "Registry Tracked"
    : card.verification;

  return {
    ...card,
    name: profile?.displayName || card.name,
    handle: profile?.handle || card.handle,
    image: profile?.avatarUrl ?? card.image,
    bio: profile?.bio?.trim() || card.bio,
    reputation,
    verification,
    globalRank: profile?.globalRank !== null && profile?.globalRank !== undefined ? `Global Rank #${profile.globalRank}` : card.globalRank,
    placeholderLabel:
      profile && (profile.sourceMeta.isPlaceholder || profile.sourceMeta.dataSource === "synthetic_fallback")
        ? "Placeholder intelligence"
        : null,
  };
}

function useFinePointer() {
  const [supportsFinePointer, setSupportsFinePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncPointerState = () => setSupportsFinePointer(mediaQuery.matches);

    syncPointerState();
    mediaQuery.addEventListener("change", syncPointerState);

    return () => {
      mediaQuery.removeEventListener("change", syncPointerState);
    };
  }, []);

  return supportsFinePointer;
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
}: {
  reviewed: number;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const progress = Math.max(0, Math.min(100, Math.round((reviewed / safeTotal) * 100)));

  return (
    <div
      className={cx(
        "rounded-2xl border border-white/8 bg-surface-container-low/80 px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.24)] backdrop-blur-md",
        "w-full",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-label text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
          Verdict Queue
        </span>
        <span className="font-label text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-secondary">
          {reviewed} / {total} reviewed
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-secondary/80 to-primary"
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
  successBurst,
  layout,
  onClick,
}: {
  label: string;
  icon: string;
  tone: "primary" | "tertiary";
  disabled: boolean;
  active: boolean;
  successBurst: boolean;
  layout: VerdictCardLayout;
  onClick: () => void;
}) {
  const isPrimary = tone === "primary";
  const [isPressed, setIsPressed] = useState(false);
  const shouldIdleBounce = !disabled && !active && !successBurst && !isPressed;
  const sizeClasses =
    layout === "desktop"
      ? "h-16 rounded-2xl text-[0.76rem] tracking-[0.16em]"
      : "h-12 rounded-xl text-[0.64rem] tracking-[0.14em]";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onTapStart={() => setIsPressed(true)}
      onTap={() => setIsPressed(false)}
      onTapCancel={() => setIsPressed(false)}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      animate={
        shouldIdleBounce
          ? {
              y: [0, -0.75, 0],
              scale: [1, 1.003, 1],
            }
          : {
              y: 0,
              scale: active ? 0.985 : 1,
            }
      }
      transition={
        shouldIdleBounce
          ? {
              duration: isPrimary ? 3.2 : 3,
              ease: [0.4, 0, 0.2, 1],
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: isPrimary ? 0.9 : 1.1,
              delay: isPrimary ? 0.16 : 0,
            }
          : {
              type: "spring",
              stiffness: 340,
              damping: 24,
              mass: 0.62,
            }
      }
      className={cx(
        "kv-focus-ring relative flex w-full items-center justify-center gap-2 overflow-hidden border font-label font-semibold uppercase text-center transition-[transform,box-shadow,opacity,border-color,background-color] duration-200 disabled:cursor-wait disabled:opacity-70",
        sizeClasses,
        isPrimary
          ? "border-primary/30 bg-primary text-on-primary shadow-[0_16px_34px_rgba(0,0,0,0.32)] hover:bg-primary/90"
          : "border-tertiary/35 bg-tertiary/10 text-tertiary shadow-[0_16px_34px_rgba(0,0,0,0.22)] hover:bg-tertiary/14",
        active && (isPrimary ? "shadow-[0_0_26px_rgba(146,245,143,0.22)]" : "shadow-[0_0_24px_rgba(255,116,108,0.18)]"),
      )}
    >
      <AnimatePresence>
        {successBurst ? (
          <motion.span
            key="success-burst"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.76 }}
            animate={{ opacity: [0.08, 0.6, 0], scale: [0.82, 1.18, 1.56] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              "pointer-events-none absolute inset-[-20%] rounded-[inherit]",
              isPrimary
                ? "bg-[radial-gradient(circle,rgba(156,255,147,0.42)_0%,rgba(156,255,147,0.18)_42%,transparent_74%)]"
                : "bg-[radial-gradient(circle,rgba(255,77,109,0.42)_0%,rgba(255,77,109,0.18)_42%,transparent_74%)]",
            )}
          />
        ) : null}
      </AnimatePresence>
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_56%)] opacity-80" />
      <Icon
        name={icon}
        filled={isPrimary}
        className={cx("relative z-10", layout === "desktop" ? "text-[1.35rem]" : "text-[1.2rem]")}
      />
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

function VerdictGestureHint({
  layout,
  copy,
  subdued = false,
  className,
}: {
  layout: VerdictCardLayout;
  copy?: string;
  subdued?: boolean;
  className?: string;
}) {
  const isDesktop = layout === "desktop";

  return (
    <motion.div
      initial={false}
      animate={{ opacity: subdued ? 0.34 : 0.72 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cx(
        "flex items-center justify-center gap-2.5 text-center",
        isDesktop ? "px-4" : "px-2",
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        animate={{ x: [0, -4, 0], opacity: [0.26, 0.62, 0.26] }}
        transition={{ duration: 1.9, ease: [0.4, 0, 0.2, 1], repeat: Number.POSITIVE_INFINITY }}
        className="flex items-center"
      >
        <Icon name="chevron_left" className={cx("text-on-surface-variant/80", isDesktop ? "text-[1rem]" : "text-[0.9rem]")} />
      </motion.span>

      <span
        className={cx(
          "font-label font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70",
          isDesktop ? "text-[0.58rem]" : "text-[0.54rem] leading-5",
        )}
      >
        {copy ?? "Swipe left for next - swipe right for previous"}
      </span>

      <motion.span
        aria-hidden="true"
        animate={{ x: [0, 4, 0], opacity: [0.26, 0.62, 0.26] }}
        transition={{
          duration: 1.9,
          ease: [0.4, 0, 0.2, 1],
          repeat: Number.POSITIVE_INFINITY,
          delay: 0.18,
        }}
        className="flex items-center"
      >
        <Icon name="chevron_right" className={cx("text-on-surface-variant/80", isDesktop ? "text-[1rem]" : "text-[0.9rem]")} />
      </motion.span>
    </motion.div>
  );
}

function DesktopBrowseButton({
  direction,
  disabled,
  onClick,
}: {
  direction: BrowseDirection;
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";

  return (
    <button
      type="button"
      aria-label={isPrevious ? "Previous KOL" : "Next KOL"}
      disabled={disabled}
      onClick={onClick}
      className="kv-focus-ring inline-flex h-9 items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 font-label text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors duration-200 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isPrevious ? <Icon name="chevron_left" className="text-[0.95rem]" /> : null}
      <span>{isPrevious ? "Previous" : "Next"}</span>
      {!isPrevious ? <Icon name="chevron_right" className="text-[0.95rem]" /> : null}
    </button>
  );
}

function DesktopBrowseControls({
  canGoPrevious,
  canGoNext,
  disabled,
  onBrowse,
}: {
  canGoPrevious: boolean;
  canGoNext: boolean;
  disabled: boolean;
  onBrowse: (direction: BrowseDirection) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <DesktopBrowseButton
        direction="previous"
        disabled={disabled || !canGoPrevious}
        onClick={() => onBrowse("previous")}
      />
      <VerdictGestureHint layout="desktop" copy="Browse queue" subdued={disabled} />
      <DesktopBrowseButton
        direction="next"
        disabled={disabled || !canGoNext}
        onClick={() => onBrowse("next")}
      />
    </div>
  );
}

function VerdictCard({
  card,
  layout,
  isExpanded,
  intelligenceState,
  direction,
  pendingDirection,
  voteLocked,
  enableInteractiveMotion,
  feedback,
  onExpand,
  onCollapse,
  onRetryIntelligence,
  onReject,
  onEndorse,
}: {
  card: HomeCardView;
  layout: VerdictCardLayout;
  isExpanded: boolean;
  intelligenceState?: KolIntelligenceState;
  direction: CardTransitionDirection | null;
  pendingDirection: SwipeDirection | null;
  voteLocked: boolean;
  enableInteractiveMotion: boolean;
  feedback: { text: string; tone: FeedbackTone } | null;
  onExpand: () => void;
  onCollapse: () => void;
  onRetryIntelligence: () => void;
  onReject: () => void;
  onEndorse: () => void;
}) {
  const isDesktop = layout === "desktop";
  const prefersReducedMotion = useReducedMotion();
  const supportsFinePointer = useFinePointer();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 220, damping: 26, mass: 0.5 });
  const rotateY = useSpring(tiltY, { stiffness: 220, damping: 26, mass: 0.5 });
  const canTilt = isDesktop && enableInteractiveMotion && supportsFinePointer && !prefersReducedMotion;
  const imageSize = isDesktop ? "h-44 w-44 rounded-3xl" : "h-20 w-20 rounded-xl";
  const containerClasses = isDesktop
    ? "w-full rounded-[2rem] border border-white/8 px-7 py-6"
    : "w-full rounded-[1.5rem] border border-white/8 px-4 py-3";
  const cardHeight = isDesktop ? "min-h-[31rem]" : "min-h-0";
  const feedbackText = feedback?.text ?? "";
  const summaryCard = resolveSummaryCard(card, intelligenceState);

  useEffect(() => {
    if (!canTilt) {
      tiltX.set(0);
      tiltY.set(0);
    }
  }, [canTilt, tiltX, tiltY]);

  if (isExpanded) {
    if (intelligenceState?.status === "ready") {
      return (
        <KolDetailCard
          detail={intelligenceState.profile}
          reasonTags={card.reasonTags}
          layout={layout}
          onCollapse={onCollapse}
        />
      );
    }

    return (
      <VerdictDetailStatusCard
        layout={layout}
        status={intelligenceState?.status === "not_found" ? "not_found" : intelligenceState?.status === "error" ? "error" : "loading"}
        message={intelligenceState?.status === "error" || intelligenceState?.status === "not_found" ? intelligenceState.message : undefined}
        onRetry={onRetryIntelligence}
        onCollapse={onCollapse}
      />
    );
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!canTilt) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;

    tiltY.set(clamp(normalizedX * 10, -5, 5));
    tiltX.set(clamp(-normalizedY * 6, -3, 3));
  }

  function resetTilt() {
    tiltX.set(0);
    tiltY.set(0);
  }

  if (isDesktop) {
    return (
      <motion.div
        onClick={onExpand}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        onPointerCancel={resetTilt}
        style={canTilt ? { rotateX, rotateY, transformPerspective: 1600 } : undefined}
        className={cx(
          "group relative overflow-hidden rounded-[2rem] border border-white/8 bg-surface-container-high p-6 shadow-surface-lg transition-[box-shadow,transform,border-color] duration-300 will-change-transform [transform-style:preserve-3d]",
          "cursor-pointer",
          canTilt ? "hover:border-secondary/18 hover:shadow-[0_34px_82px_rgba(0,0,0,0.52)]" : "",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(48,200,232,0.08),transparent_28%),radial-gradient(circle_at_76%_72%,rgba(146,245,143,0.07),transparent_34%),linear-gradient(180deg,rgba(23,29,30,0.98),rgba(9,12,13,1))]" />
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            opacity: direction === "trust" ? 0.62 : direction === "scam" ? 0.58 : 0,
            scale: direction ? 1 : 0.94,
          }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          className={cx(
            "pointer-events-none absolute inset-0",
            direction === "trust"
              ? "bg-[radial-gradient(circle_at_74%_58%,rgba(146,245,143,0.2),transparent_42%)]"
              : "bg-[radial-gradient(circle_at_74%_58%,rgba(255,116,108,0.17),transparent_42%)]",
          )}
        />

        <div className="relative z-10 grid min-h-[30rem] grid-cols-[0.9fr_1.1fr] gap-6">
          <section className="flex flex-col justify-between rounded-[1.5rem] border border-white/8 bg-black/16 p-6">
            <div>
              <Pill
                tone={summaryCard.reputation >= 70 ? "primary" : "secondary"}
                className="border-white/10 bg-surface-container-low px-3.5 py-1.5 text-[0.54rem] text-white"
              >
                <span className={cx("h-2 w-2 rounded-full", summaryCard.reputation >= 70 ? "bg-primary" : "bg-secondary")} />
                {summaryCard.verification}
              </Pill>

              <div className="relative mt-6 w-fit">
                <div className={cx("absolute inset-0 rounded-3xl blur-3xl", summaryCard.reputation >= 70 ? "bg-primary/10" : "bg-secondary/10")} />
                <div className={cx("relative overflow-hidden border border-white/10 bg-surface-container-highest shadow-[0_16px_34px_rgba(0,0,0,0.3)]", imageSize)}>
                  <ImageCard
                    src={summaryCard.image}
                    alt={`${summaryCard.name} avatar`}
                    priority
                    sizes="220px"
                    className="h-full w-full"
                    imageClassName="object-cover object-center grayscale-[12%] contrast-110"
                    fallbackSrc="/default-avatar.svg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-transparent to-transparent" />
                </div>
              </div>

              <div className="mt-6">
                <h1 className="font-display text-[3.55rem] font-bold leading-[0.92] tracking-[-0.08em] text-white">
                  {summaryCard.name}
                </h1>
                <p className="mt-1 font-label text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-secondary">
                  {summaryCard.handle}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-on-surface-variant">
                  <span>{card.role}</span>
                  <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
                  <span>{summaryCard.globalRank}</span>
                  <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
                  <span>Active</span>
                </div>
              </div>
            </div>

            <p className="mt-6 max-w-[26rem] text-[0.95rem] leading-7 text-on-surface-variant">
              {summaryCard.bio}
            </p>
          </section>

          <section className="flex flex-col justify-between rounded-[1.5rem] border border-white/8 bg-surface-container-low/78 p-6">
            <div>
              <div className="grid grid-cols-[1fr_auto] items-start gap-5">
                <div>
                  <div className="kv-label text-primary">Verdict Score</div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="font-display text-[5.1rem] font-bold leading-none tracking-[-0.09em] text-primary tabular-nums">
                      {summaryCard.reputation}
                    </span>
                    <span className="pb-3 font-label text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                      /100
                    </span>
                  </div>
                </div>
                {card.reasonTags.length > 0 || summaryCard.placeholderLabel ? (
                  <div className="flex max-w-[13rem] flex-wrap justify-end gap-2">
                    {card.reasonTags.slice(0, 2).map((tag) => (
                      <span
                        key={`${card.slug}-${tag.label}`}
                        className={cx(
                          "inline-flex items-center rounded-full border px-3 py-1.5 font-label text-[0.56rem] font-semibold uppercase tracking-[0.12em]",
                          reasonTagToneClasses(tag.tone),
                        )}
                      >
                        {tag.label}
                      </span>
                    ))}
                    {summaryCard.placeholderLabel ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 font-label text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                        {summaryCard.placeholderLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-8 rounded-[1.35rem] border border-white/8 bg-black/16 px-6 py-6">
                <div className="kv-label text-on-surface-variant/80">Verdict Prompt</div>
                <p className="mt-2 font-display text-[2.4rem] font-bold leading-[1] tracking-[-0.045em] text-white [word-spacing:0.08em]">
                  Is this KOL trustworthy?
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div
                aria-live="polite"
                className={cx(
                  "min-h-[1.2rem] pb-3 text-center font-label text-[0.6rem] font-semibold uppercase tracking-[0.16em]",
                  feedbackColorClass(feedback?.tone),
                )}
              >
                {feedbackText}
              </div>

              <div className="grid grid-cols-2 gap-3" onClick={(event) => event.stopPropagation()}>
                <VerdictActionButton
                  label="Reject"
                  icon="close"
                  tone="tertiary"
                  successBurst={direction === "scam"}
                  layout={layout}
                  disabled={voteLocked}
                  active={pendingDirection === "scam"}
                  onClick={onReject}
                />
                <VerdictActionButton
                  label="Endorse"
                  icon="favorite"
                  tone="primary"
                  successBurst={direction === "trust"}
                  layout={layout}
                  disabled={voteLocked}
                  active={pendingDirection === "trust"}
                  onClick={onEndorse}
                />
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={onExpand}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
      style={canTilt ? { rotateX, rotateY, transformPerspective: 1600 } : undefined}
      className={cx(
        "group relative overflow-hidden bg-surface-container-high shadow-surface-lg transition-[box-shadow,transform,border-color] duration-300 will-change-transform [transform-style:preserve-3d]",
        "cursor-pointer",
        containerClasses,
        cardHeight,
        canTilt ? "hover:border-secondary/18 hover:shadow-[0_34px_82px_rgba(0,0,0,0.52)]" : "",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(48,200,232,0.08),transparent_30%),linear-gradient(180deg,rgba(23,29,30,0.98),rgba(9,12,13,1))]" />
      <div
        className={cx(
          "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_50%_54%,rgba(0,207,252,0.16),transparent_54%)] opacity-0 transition-opacity duration-300",
          canTilt ? "group-hover:opacity-100" : "",
        )}
      />
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
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_62%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex justify-center">
          <Pill
            tone={summaryCard.reputation >= 70 ? "primary" : "secondary"}
            className="border-white/10 bg-black/20 px-3 py-1.5 text-[0.52rem] text-white"
          >
            <span
              className={cx(
                "h-2 w-2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.6)]",
                summaryCard.reputation >= 70 ? "bg-primary" : "bg-secondary",
              )}
            />
            {summaryCard.verification}
          </Pill>
        </div>

        <div className={cx("relative mx-auto", isDesktop ? "mb-5 mt-3" : "mb-2 mt-2")}>
          <div className={cx("absolute inset-0 rounded-[2rem] blur-2xl", summaryCard.reputation >= 70 ? "bg-primary/10" : "bg-secondary/10")} />
          <div className={cx("relative overflow-hidden border border-white/8 bg-surface-container-highest shadow-[0_18px_40px_rgba(0,0,0,0.32)]", imageSize)}>
            <ImageCard
              src={summaryCard.image}
              alt={`${summaryCard.name} avatar`}
              priority
              sizes={isDesktop ? "320px" : "240px"}
              className="h-full w-full"
              imageClassName="object-cover object-center grayscale-[10%] contrast-110"
              fallbackSrc="/default-avatar.svg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-transparent" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[30rem] text-center">
          <h1
            className={cx(
              "font-display font-black leading-[0.92] tracking-[-0.08em] text-white",
              isDesktop ? "text-[4.35rem]" : "text-[2rem]",
            )}
          >
            {summaryCard.name}
          </h1>
          <p className={cx("mt-1 font-label font-semibold uppercase tracking-[0.14em] text-secondary", isDesktop ? "text-[0.78rem]" : "text-[0.62rem]")}>
            {summaryCard.handle}
          </p>
          <div
            className={cx(
              "mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-on-surface-variant/70",
              isDesktop ? "text-[0.74rem]" : "text-[0.68rem]",
            )}
          >
            <span className="font-medium">{card.role}</span>
            <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
            <span className="font-medium">{summaryCard.globalRank}</span>
            <span className="h-1 w-1 rounded-full bg-on-surface-variant/35" />
            <span className="font-medium">Active</span>
          </div>

          <div className={cx("mx-auto w-fit border border-primary/20 bg-black/20 shadow-[0_16px_34px_rgba(0,0,0,0.28)]", isDesktop ? "mt-3 rounded-2xl px-4 py-3" : "mt-2 rounded-xl px-3 py-2")}>
            <div className="font-label text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-primary/90">
              Verdict Score
            </div>
            <div className="mt-1.5 flex items-end justify-center gap-1">
              <span className={cx("font-display font-bold leading-none tracking-[-0.08em] text-primary", isDesktop ? "text-[4.15rem]" : "text-[2.25rem]")}>
                {summaryCard.reputation}
              </span>
              <span className={cx("font-label font-semibold uppercase tracking-[0.12em] text-on-surface-variant", isDesktop ? "pb-1.5 text-[0.78rem]" : "pb-1 text-[0.66rem]")}>/100</span>
            </div>
          </div>

          {card.reasonTags.length > 0 || summaryCard.placeholderLabel ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
              className={cx("flex flex-wrap items-center justify-center gap-2", isDesktop ? "mt-3" : "mt-2")}
            >
              {card.reasonTags.slice(0, 2).map((tag, index) => (
                <motion.span
                  key={`${card.slug}-${tag.label}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: index * 0.05 }}
                  className={cx(
                    "inline-flex items-center rounded-full border font-label font-semibold uppercase tracking-[0.1em]",
                    isDesktop ? "px-3 py-1.5 text-[0.56rem]" : "px-2.5 py-1 text-[0.5rem]",
                    reasonTagToneClasses(tag.tone),
                  )}
                >
                  {tag.label}
                </motion.span>
              ))}
              {summaryCard.placeholderLabel ? (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: card.reasonTags.length * 0.05 }}
                  className={cx(
                    "inline-flex items-center rounded-full border border-white/10 bg-white/6 font-label font-semibold uppercase tracking-[0.1em] text-on-surface-variant",
                    isDesktop ? "px-3 py-1.5 text-[0.56rem]" : "px-2.5 py-1 text-[0.5rem]",
                  )}
                >
                  {summaryCard.placeholderLabel}
                </motion.span>
              ) : null}
            </motion.div>
          ) : null}

          <p
            className={cx(
              "mx-auto max-w-[30rem] text-on-surface-variant",
              isDesktop ? "mt-3 text-[0.96rem] leading-7" : "mt-2 text-[0.76rem] leading-5",
            )}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: isDesktop ? 2 : 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {summaryCard.bio}
          </p>
        </div>

        <div className={cx("rounded-2xl border border-white/8 bg-black/16 text-center", isDesktop ? "mt-4 px-7 py-5" : "mt-3 px-3 py-3")}>
          <div className="font-label text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/75">
            Verdict Prompt
          </div>
          <p
            className={cx(
              "mt-2 font-display font-bold leading-[1] tracking-[-0.04em] text-white [word-spacing:0.08em]",
              isDesktop ? "text-[2.35rem]" : "text-[1.22rem]",
            )}
          >
            Is this KOL trustworthy?
          </p>
        </div>

        <div className={cx(isDesktop ? "mt-4" : "mt-3")}>
          <div
            aria-live="polite"
            className={cx(
              "text-center font-label text-[0.56rem] font-semibold uppercase tracking-[0.14em]",
              isDesktop ? "min-h-[1rem] pb-2" : "min-h-3 pb-1",
              feedbackColorClass(feedback?.tone),
            )}
          >
            {feedbackText}
          </div>

          <div
            className={cx("grid grid-cols-2", isDesktop ? "gap-3" : "gap-2.5")}
            onClick={(event) => event.stopPropagation()}
          >
            <VerdictActionButton
              label="Reject"
              icon="close"
              tone="tertiary"
              successBurst={direction === "scam"}
              layout={layout}
              disabled={voteLocked}
              active={pendingDirection === "scam"}
              onClick={onReject}
            />
            <VerdictActionButton
              label="Endorse"
              icon="favorite"
              tone="primary"
              successBurst={direction === "trust"}
              layout={layout}
              disabled={voteLocked}
              active={pendingDirection === "trust"}
              onClick={onEndorse}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VerdictLoadingState({ layout }: { layout: VerdictCardLayout }) {
  const isDesktop = layout === "desktop";

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.8rem] border border-white/8 bg-surface-container-high shadow-surface-lg",
        isDesktop ? "w-full px-7 py-6" : "w-full px-4 py-4",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(0,207,252,0.12),transparent_28%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="h-8 w-36 rounded-full bg-white/10 motion-safe:animate-pulse" />
        <div className={cx("mt-5 rounded-3xl bg-white/6 motion-safe:animate-pulse", isDesktop ? "h-44 w-44" : "h-28 w-28")} />
        <div className="mt-5 h-4 w-28 rounded-full bg-white/10 motion-safe:animate-pulse" />
        <div className={cx("mt-4 h-12 rounded-full bg-white/10 motion-safe:animate-pulse", isDesktop ? "w-80" : "w-56")} />
        <div className={cx("mt-4 h-20 rounded-2xl border border-white/6 bg-black/20 px-6 py-4 motion-safe:animate-pulse", isDesktop ? "w-52" : "w-40")} />
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="h-7 w-24 rounded-full bg-white/8 motion-safe:animate-pulse" />
          <div className="h-7 w-20 rounded-full bg-white/8 motion-safe:animate-pulse" />
        </div>
        <div className={cx("mt-4 h-16 rounded-2xl border border-white/6 bg-black/16 motion-safe:animate-pulse", isDesktop ? "w-[34rem]" : "w-full")} />
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <div className={cx("rounded-2xl bg-white/8 motion-safe:animate-pulse", isDesktop ? "h-16" : "h-14")} />
          <div className={cx("rounded-2xl bg-white/10 motion-safe:animate-pulse", isDesktop ? "h-16" : "h-14")} />
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
        "relative overflow-hidden rounded-[1.8rem] border border-white/8 bg-surface-container-high shadow-surface-lg",
        isDesktop ? "w-full px-7 py-7" : "w-full px-4 py-5",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(0,207,252,0.12),transparent_28%),radial-gradient(circle_at_50%_78%,rgba(156,255,147,0.09),transparent_34%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <Pill tone="secondary" className="bg-black/25 px-4 py-2 text-[0.56rem] text-white backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(0,207,252,0.7)]" />
          {copy.eyebrow}
        </Pill>

        <div className={cx("relative mt-6 flex items-center justify-center rounded-3xl border border-white/8 bg-surface-container-highest/70", isDesktop ? "h-36 w-36" : "h-28 w-28")}>
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,rgba(48,200,232,0.14),transparent_55%)]" />
          <Icon name={state === "error" ? "warning" : "check_circle"} className={cx("relative z-10 text-secondary", isDesktop ? "text-[3.6rem]" : "text-[3rem]")} />
        </div>

        <h2 className={cx("mt-6 font-display font-bold leading-[0.98] tracking-[-0.075em] text-white", isDesktop ? "text-[3.1rem]" : "text-[2rem]")}>
          {copy.title}
        </h2>
        <p className={cx("mt-3 max-w-[30rem] text-on-surface-variant", isDesktop ? "text-base leading-7" : "text-sm leading-6")}>
          {copy.message}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="kv-focus-ring rounded-xl border border-secondary/25 bg-secondary/10 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-secondary transition-colors duration-200 hover:bg-secondary/16"
          >
            {retryLabel}
          </button>

          {showLeaderboard ? (
            <Link
              href="/leaderboard"
              className="kv-focus-ring rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-on-surface transition-colors duration-200 hover:bg-white/8"
            >
              Leaderboard
            </Link>
          ) : null}

          {showAddKol ? (
            <Link
              href="/add"
              className="kv-focus-ring rounded-xl border border-primary/20 bg-primary/10 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary transition-colors duration-200 hover:bg-primary/16"
            >
              Add KOL
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VerdictDetailStatusCard({
  layout,
  status,
  message,
  onRetry,
  onCollapse,
}: {
  layout: VerdictCardLayout;
  status: "loading" | "error" | "not_found";
  message?: string;
  onRetry: () => void;
  onCollapse: () => void;
}) {
  const isDesktop = layout === "desktop";
  const isLoading = status === "loading";
  const title =
    status === "loading"
      ? "Loading profile intelligence"
      : status === "not_found"
        ? "Profile intelligence unavailable"
        : "Unable to load profile intelligence";
  const body =
    message ??
    (status === "loading"
      ? "Syncing intelligence data from the registry."
      : "Try again in a moment or return to the summary card.");

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.8rem] border border-white/8 bg-surface-container-high shadow-surface-lg",
        isDesktop ? "w-full px-7 py-6" : "w-full px-4 py-4",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(48,200,232,0.08),transparent_24%),radial-gradient(circle_at_80%_16%,rgba(146,245,143,0.08),transparent_26%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <Pill className="border-white/10 bg-black/18 text-white">
            <span className={cx("h-2 w-2 rounded-full", isLoading ? "bg-secondary" : "bg-on-surface-variant")} />
            {isLoading ? "Intelligence sync" : "Detail state"}
          </Pill>

          <button
            type="button"
            onClick={onCollapse}
            className="kv-focus-ring inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 font-label text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors duration-200 hover:bg-white/8 hover:text-white"
            aria-label="Back to summary view"
          >
            <Icon name="arrow_back" className="text-[0.95rem]" />
            <span>{isDesktop ? "Back to Summary" : "Back"}</span>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <div className={cx("flex items-center justify-center rounded-3xl border border-white/8 bg-surface-container-highest/70", isDesktop ? "h-28 w-28" : "h-24 w-24")}>
            {isLoading ? (
              <div className="h-12 w-12 rounded-full border-2 border-secondary/20 border-t-secondary motion-safe:animate-spin" />
            ) : (
              <Icon
                name={status === "not_found" ? "person_search" : "warning"}
                className={cx("text-secondary", isDesktop ? "text-[2.8rem]" : "text-[2.35rem]")}
              />
            )}
          </div>

          <h3 className={cx("mt-6 font-display font-bold leading-[0.96] tracking-[-0.06em] text-white", isDesktop ? "text-[2.5rem]" : "text-[1.7rem]")}>
            {title}
          </h3>
          <p className={cx("mt-3 max-w-[30rem] text-on-surface-variant", isDesktop ? "text-[0.95rem] leading-7" : "text-[0.84rem] leading-6")}>
            {body}
          </p>

          {!isLoading ? (
            <button
              type="button"
              onClick={onRetry}
              className="kv-focus-ring mt-6 rounded-xl border border-secondary/25 bg-secondary/10 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-secondary transition-colors duration-200 hover:bg-secondary/16"
            >
              Retry Intelligence
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DesktopVerdictSurface({
  activeCard,
  isExpanded,
  intelligenceState,
  direction,
  voteLocked,
  browseLocked,
  pendingVote,
  feedback,
  nextCard,
  isTransitioning,
  reviewedCount,
  totalCount,
  canBrowsePrevious,
  canBrowseNext,
  onBrowse,
  onVote,
  onExpand,
  onCollapse,
  onRetryIntelligence,
}: {
  activeCard: HomeCardView;
  isExpanded: boolean;
  intelligenceState?: KolIntelligenceState;
  direction: CardTransitionDirection | null;
  voteLocked: boolean;
  browseLocked: boolean;
  pendingVote: PendingVote | null;
  feedback: { text: string; tone: FeedbackTone } | null;
  nextCard: HomeCardView | null;
  isTransitioning: boolean;
  reviewedCount: number;
  totalCount: number;
  canBrowsePrevious: boolean;
  canBrowseNext: boolean;
  onBrowse: (direction: BrowseDirection) => void;
  onVote: (card: HomeCardView, next: SwipeDirection) => Promise<void>;
  onExpand: () => void;
  onCollapse: () => void;
  onRetryIntelligence: () => void;
}) {
  return (
    <div className="relative flex w-full flex-col gap-4">
      <VerdictProgress reviewed={reviewedCount} total={totalCount} />
      <AnimatePresence mode="wait" initial={false}>
        {!isTransitioning ? (
          <motion.div
            key={activeCard.slug}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={
              exitsLeft(direction)
                ? { opacity: 0, x: [0, -10, 8, -18, -84], y: -6, scale: 0.98 }
                : { opacity: 0, x: 84, y: -8, scale: 0.985 }
            }
            transition={{ duration: CARD_EXIT_MS / 1000, ease: [0.2, 0, 0, 1] }}
          >
            <VerdictCard
              card={activeCard}
              layout="desktop"
              isExpanded={isExpanded}
              intelligenceState={intelligenceState}
              direction={direction}
              pendingDirection={pendingVote?.slug === activeCard.slug ? pendingVote.direction : null}
              voteLocked={voteLocked}
              enableInteractiveMotion={!voteLocked && !isTransitioning && !isExpanded}
              feedback={feedback}
              onExpand={onExpand}
              onCollapse={onCollapse}
              onRetryIntelligence={onRetryIntelligence}
              onReject={() => void onVote(activeCard, "scam")}
              onEndorse={() => void onVote(activeCard, "trust")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DesktopBrowseControls
        canGoPrevious={canBrowsePrevious}
        canGoNext={canBrowseNext}
        disabled={browseLocked || isTransitioning}
        onBrowse={onBrowse}
      />

      <QueueImagePreload card={nextCard} />
    </div>
  );
}

function MobileVerdictSurface({
  activeCard,
  isExpanded,
  intelligenceState,
  direction,
  voteLocked,
  browseLocked,
  pendingVote,
  feedback,
  nextCard,
  isTransitioning,
  reviewedCount,
  totalCount,
  onBrowse,
  onVote,
  onExpand,
  onCollapse,
  onRetryIntelligence,
}: {
  activeCard: HomeCardView;
  isExpanded: boolean;
  intelligenceState?: KolIntelligenceState;
  direction: CardTransitionDirection | null;
  voteLocked: boolean;
  browseLocked: boolean;
  pendingVote: PendingVote | null;
  feedback: { text: string; tone: FeedbackTone } | null;
  nextCard: HomeCardView | null;
  isTransitioning: boolean;
  reviewedCount: number;
  totalCount: number;
  onBrowse: (direction: BrowseDirection) => void;
  onVote: (card: HomeCardView, next: SwipeDirection) => Promise<void>;
  onExpand: () => void;
  onCollapse: () => void;
  onRetryIntelligence: () => void;
}) {
  return (
    <div className="relative flex w-full max-w-[23.25rem] flex-col gap-2">
      <VerdictProgress reviewed={reviewedCount} total={totalCount} />
      <AnimatePresence mode="wait" initial={false}>
        {!isTransitioning ? (
          <motion.div
            key={activeCard.slug}
            drag={!browseLocked}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (browseLocked) {
                return;
              }

              const browseDirection = browseDirectionFromOffset(info.offset.x, info.offset.y);
              if (browseDirection) {
                onBrowse(browseDirection);
              }
            }}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={
              exitsLeft(direction)
                ? { opacity: 0, x: [0, -8, 6, -14, -74], y: -4, scale: 0.98 }
                : { opacity: 0, x: 74, y: -6, scale: 0.985 }
            }
            transition={{ duration: CARD_EXIT_MS / 1000, ease: [0.2, 0, 0, 1] }}
          >
            <VerdictCard
              card={activeCard}
              layout="mobile"
              isExpanded={isExpanded}
              intelligenceState={intelligenceState}
              direction={direction}
              pendingDirection={pendingVote?.slug === activeCard.slug ? pendingVote.direction : null}
              voteLocked={voteLocked}
              enableInteractiveMotion={false}
              feedback={feedback}
              onExpand={onExpand}
              onCollapse={onCollapse}
              onRetryIntelligence={onRetryIntelligence}
              onReject={() => void onVote(activeCard, "scam")}
              onEndorse={() => void onVote(activeCard, "trust")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <VerdictGestureHint layout="mobile" subdued={browseLocked || isTransitioning} className="hidden" />

      <QueueImagePreload card={nextCard} />
    </div>
  );
}

export function HomeScreen() {
  const { session, requireWalletForWrite } = useWalletSession();
  const [queue, setQueue] = useState<HomeCardView[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [intelligenceBySlug, setIntelligenceBySlug] = useState<Record<string, KolIntelligenceState>>({});
  const [direction, setDirection] = useState<CardTransitionDirection | null>(null);
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);
  const [isAuthPrompting, setIsAuthPrompting] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(null);
  const [reviewedSlugs, setReviewedSlugs] = useState<Record<string, boolean>>({});
  const [loadState, setLoadState] = useState<HomeLoadState>("loading");
  const [reloadNonce, setReloadNonce] = useState(0);
  const acknowledgementTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const authPromptingRef = useRef(false);
  const queueRef = useRef<HomeCardView[]>([]);
  const intelligenceBySlugRef = useRef<Record<string, KolIntelligenceState>>({});
  const currentIndexRef = useRef(0);
  const reviewedSlugsRef = useRef<Record<string, boolean>>({});
  const actionLockedRef = useRef(false);
  const voteLockedRef = useRef(false);
  const activeCardSlugRef = useRef<string | null>(null);

  const activeCard = currentIndex < queue.length ? queue[currentIndex] : null;
  const activeSlug = activeCard?.slug ?? null;
  const activeIntelligence = activeCard ? intelligenceBySlug[activeCard.slug] : undefined;
  const nextCard = currentIndex + 1 < queue.length ? queue[currentIndex + 1] : null;
  const reviewedCount = Math.min(queue.length, Object.keys(reviewedSlugs).length);
  const voteLocked = pendingVote !== null || isAuthPrompting || isAcknowledging || isTransitioning;
  const browseLocked = voteLocked || isExpanded;
  const canBrowsePrevious = currentIndex > 0;
  const canBrowseNext = currentIndex + 1 < queue.length;
  const showQueueSurface = loadState === "ready" && activeCard !== null;

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    intelligenceBySlugRef.current = intelligenceBySlug;
  }, [intelligenceBySlug]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    reviewedSlugsRef.current = reviewedSlugs;
  }, [reviewedSlugs]);

  useEffect(() => {
    actionLockedRef.current = pendingVote !== null || isAcknowledging || isTransitioning;
  }, [isAcknowledging, isTransitioning, pendingVote]);

  useEffect(() => {
    voteLockedRef.current = voteLocked;
  }, [voteLocked]);

  useEffect(() => {
    activeCardSlugRef.current = activeCard?.slug ?? null;
  }, [activeCard]);

  useEffect(() => {
    setIsExpanded(false);
  }, [activeCard?.slug]);

  const loadKolIntelligence = useCallback(async (
    slug: string,
    options: {
      force?: boolean;
      signal?: AbortSignal;
    } = {},
  ) => {
    const existingState = intelligenceBySlugRef.current[slug];

    if (
      !options.force &&
      (existingState?.status === "loading" ||
        existingState?.status === "ready" ||
        existingState?.status === "not_found" ||
        existingState?.status === "error")
    ) {
      return;
    }

    setIntelligenceBySlug((current) => ({
      ...current,
      [slug]: {
        status: "loading",
      },
    }));

    try {
      const response = await fetch(`/api/kols/${slug}/intelligence`, {
        cache: "no-store",
        signal: options.signal,
      });
      const payload = await parseApiResponse<KolProfileDetailResponse>(response);

      setIntelligenceBySlug((current) => ({
        ...current,
        [slug]: {
          status: "ready",
          profile: payload.profile,
        },
      }));
    } catch (error) {
      if (options.signal?.aborted) {
        return;
      }

      if (error instanceof ApiClientError && error.statusCode === 404) {
        setIntelligenceBySlug((current) => ({
          ...current,
          [slug]: {
            status: "not_found",
            message: "No stored profile intelligence is available for this KOL yet.",
          },
        }));
        return;
      }

      setIntelligenceBySlug((current) => ({
        ...current,
        [slug]: {
          status: "error",
          message: toUserFacingApiError(error, "Unable to load profile intelligence."),
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (!activeSlug) {
      return;
    }

    const controller = new AbortController();
    void loadKolIntelligence(activeSlug, { signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [activeSlug, loadKolIntelligence]);

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
      setIsAuthPrompting(false);
      setIsAcknowledging(false);
      setIsTransitioning(false);
      setFeedback(null);

      try {
        const cardsResponse = await fetch("/api/kols", { cache: "no-store", signal: controller.signal });
        const cardsPayload = await parseApiResponse<HomeResponse>(cardsResponse);
        const sessionQueue = resolveSessionQueue(
          buildSessionQueue(cardsPayload.cards).slice(0, MAX_QUEUE_LENGTH),
        );

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

  function advanceQueueAfterDecision(
    card: HomeCardView,
    next: SwipeDirection,
    message: string,
    tone: FeedbackTone,
  ) {
    const latestReviewedSlugs = reviewedSlugsRef.current;
    const latestQueue = queueRef.current;
    const latestIndex = currentIndexRef.current;
    const nextReviewedSlugs = {
      ...latestReviewedSlugs,
      [card.slug]: true,
    };
    const nextIndex = getNextQueueIndex(latestQueue, latestIndex + 1, nextReviewedSlugs);

    setReviewedSlugs(nextReviewedSlugs);
    setDirection(next);
    setIsAcknowledging(true);
    setFeedbackMessage(message, tone);

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

        if (nextIndex >= queueRef.current.length) {
          setLoadState("exhausted");
        }

        transitionTimeoutRef.current = null;
      }, CARD_EXIT_MS);
    }, VERDICT_ACK_MS);
  }

  async function submitVote(card: HomeCardView, next: SwipeDirection) {
    const currentReviewedSlugs = reviewedSlugsRef.current;

    if (!card || voteLockedRef.current || currentReviewedSlugs[card.slug]) {
      if (card && currentReviewedSlugs[card.slug]) {
        setTimedFeedback("Verdict recorded", "secondary");
      }
      return;
    }

    if (!session) {
      if (authPromptingRef.current) {
        return;
      }

      authPromptingRef.current = true;
      setIsAuthPrompting(true);

      try {
        const granted = await requireWalletForWrite({
          title: "Connect wallet to continue",
          message: "Connect your wallet to submit a live verdict.",
          cardClassName: "max-w-[18rem] rounded-[1.6rem] border border-white/8 bg-surface-container-high/95 px-5 py-5",
        });

        if (!granted) {
          return;
        }

        if (
          actionLockedRef.current ||
          reviewedSlugsRef.current[card.slug] ||
          activeCardSlugRef.current !== card.slug
        ) {
          return;
        }
      } finally {
        authPromptingRef.current = false;
        setIsAuthPrompting(false);
      }
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

      const successMessage = next === "trust" ? "Endorsed" : "Rejected";

      advanceQueueAfterDecision(card, next, successMessage, feedbackTone(next));
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

  function browseQueue(next: BrowseDirection) {
    if (
      browseLocked ||
      transitionTimeoutRef.current !== null ||
      acknowledgementTimeoutRef.current !== null ||
      queueRef.current.length === 0
    ) {
      return;
    }

    const latestIndex = currentIndexRef.current;
    const nextIndex = next === "next" ? latestIndex + 1 : latestIndex - 1;

    if (nextIndex < 0 || nextIndex >= queueRef.current.length || nextIndex === latestIndex) {
      return;
    }

    clearAcknowledgementTimeout();
    clearTransitionTimeout();
    clearFeedbackTimeout();
    setDirection(next);
    setFeedback(null);
    setIsTransitioning(true);

    transitionTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsTransitioning(false);
      setDirection(null);
      setFeedback(null);
      transitionTimeoutRef.current = null;
    }, CARD_EXIT_MS);
  }

  return (
    <>
      <MobileShell navKey="home" avatar={brandAvatar}>
        <section className="relative flex min-h-[calc(100dvh-13rem)] items-start justify-center py-0">
          <div className="absolute inset-x-0 top-10 h-36 rounded-full bg-secondary/5 blur-[90px]" />

          {showQueueSurface && activeCard ? (
            <MobileVerdictSurface
              activeCard={activeCard}
              isExpanded={isExpanded}
              intelligenceState={activeIntelligence}
              direction={direction}
              voteLocked={voteLocked}
              browseLocked={browseLocked}
              pendingVote={pendingVote}
              feedback={feedback}
              nextCard={nextCard}
              isTransitioning={isTransitioning}
              reviewedCount={reviewedCount}
              totalCount={queue.length}
              onBrowse={browseQueue}
              onVote={submitVote}
              onExpand={() => setIsExpanded(true)}
              onCollapse={() => setIsExpanded(false)}
              onRetryIntelligence={() => void loadKolIntelligence(activeCard.slug, { force: true })}
            />
          ) : loadState === "loading" ? (
            <div className="w-full max-w-[23.25rem]">
              <VerdictLoadingState layout="mobile" />
            </div>
          ) : (
            <div className="w-full max-w-[23.25rem]">
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
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-surface via-surface-container-lowest to-surface py-6">
          <div className="absolute left-10 top-20 h-[20rem] w-[20rem] rounded-full bg-secondary/4 blur-[120px]" />
          <div className="absolute bottom-0 right-14 h-[22rem] w-[22rem] rounded-full bg-primary/4 blur-[130px]" />

          <div className="mx-auto w-full max-w-5xl px-6">
            {showQueueSurface && activeCard ? (
              <DesktopVerdictSurface
                activeCard={activeCard}
                isExpanded={isExpanded}
                intelligenceState={activeIntelligence}
                direction={direction}
                voteLocked={voteLocked}
                browseLocked={browseLocked}
                pendingVote={pendingVote}
                feedback={feedback}
                nextCard={nextCard}
                isTransitioning={isTransitioning}
                reviewedCount={reviewedCount}
                totalCount={queue.length}
                canBrowsePrevious={canBrowsePrevious}
                canBrowseNext={canBrowseNext}
                onBrowse={browseQueue}
                onVote={submitVote}
                onExpand={() => setIsExpanded(true)}
                onCollapse={() => setIsExpanded(false)}
                onRetryIntelligence={() => void loadKolIntelligence(activeCard.slug, { force: true })}
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
          </div>
        </section>
      </DesktopShell>
    </>
  );
}
