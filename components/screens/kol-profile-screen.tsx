"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { Icon, ImageCard, TabStrip } from "@/components/ui";
import { VerifyClaimModal } from "@/components/verify-claim-modal";
import { brandAvatar } from "@/lib/mock-data";
import type {
  ActivityView,
  CommentView,
  EndorserView,
  KolProfileView,
  ProofPointView,
  Tone,
} from "@/lib/types/domain";
import { cx } from "@/lib/utils";

type MobileTab = "Overview" | "Verdicts" | "Activity";
type DesktopTab = "Overview" | "Activity" | string;

const MOBILE_TABS: MobileTab[] = ["Overview", "Verdicts", "Activity"];

function toneClasses(tone: Tone) {
  if (tone === "primary") return "bg-primary/10 text-primary";
  if (tone === "secondary") return "bg-secondary/10 text-secondary";
  if (tone === "tertiary") return "bg-tertiary/10 text-tertiary";
  return "bg-surface-variant text-on-surface-variant";
}

function HeatCell({ intensity }: { intensity: number }) {
  const classes =
    intensity >= 5
      ? "bg-primary shadow-[0_0_14px_rgba(156,255,147,0.35)]"
      : intensity === 4
        ? "bg-primary/80"
        : intensity === 3
          ? "bg-primary/55"
          : intensity === 2
            ? "bg-primary/35"
            : "bg-primary/18";

  return <div className={cx("h-4 w-4 rounded-[0.2rem]", classes)} />;
}

function SurfaceBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[1.85rem] border border-white/6 bg-surface-container-low shadow-[0_18px_36px_rgba(0,0,0,0.32)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EmptyBlock({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <SurfaceBlock className={cx("px-5 py-5", compact ? "rounded-[1.35rem]" : "")}>
      <p className="font-display text-[0.66rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{message}</p>
    </SurfaceBlock>
  );
}

function formatScore(value: number, decimals = 1) {
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(decimals);
}

function splitDisplayName(name: string) {
  const normalized = name.replace(/[_-]+/g, " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return [normalized];
  }

  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
}

function getSentimentDistribution(profile: KolProfileView) {
  const bullishCount = profile.comments.filter((comment) => comment.tone === "primary" || comment.tone === "secondary").length;
  const neutralCount = profile.comments.filter((comment) => comment.tone === "neutral").length;
  const riskCount = profile.comments.filter((comment) => comment.tone === "tertiary").length;
  const total = bullishCount + neutralCount + riskCount;

  const rawBullish = total === 0 ? Math.max(profile.kol.positive - 12, 0) : Math.round((bullishCount / total) * 100);
  const rawNeutral = total === 0 ? 12 : Math.round((neutralCount / total) * 100);
  const rawRisk = total === 0 ? profile.kol.negative : Math.round((riskCount / total) * 100);
  const normalizedTotal = Math.max(1, rawBullish + rawNeutral + rawRisk);
  const bullish = Math.round((rawBullish / normalizedTotal) * 100);
  const neutral = Math.round((rawNeutral / normalizedTotal) * 100);

  return {
    bullish,
    neutral,
    risk: Math.max(0, 100 - bullish - neutral),
  };
}

function buildRiskMessage(profile: KolProfileView) {
  if (profile.kol.negative >= 45) {
    return "Negative sentiment is elevated. Cross-check recent claims and on-chain evidence before assigning trust.";
  }

  if (profile.comments.some((comment) => comment.paymentStatus === "pending")) {
    return "Some recent claims are still pending proof confirmation. Review attached evidence before escalating trust.";
  }

  return "Recent community sentiment remains constructive, with evidence-backed claims supporting current trust levels.";
}

function CommentAction({ action }: { action: CommentView["actions"][number] }) {
  const classes = cx(
    "inline-flex items-center gap-1.5 font-display text-[0.58rem] font-bold uppercase tracking-[0.14em]",
    action.tone === "secondary"
      ? "text-secondary hover:underline"
      : "text-on-surface-variant/60 transition-colors hover:text-on-surface",
  );

  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noreferrer" className={classes}>
        <Icon name={action.icon} className="text-[0.92rem]" />
        {action.label}
      </a>
    );
  }

  return (
    <button type="button" className={classes}>
      <Icon name={action.icon} className="text-[0.92rem]" />
      {action.label}
    </button>
  );
}

function CommunityCommentCard({ comment, compact = false }: { comment: CommentView; compact?: boolean }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.8rem] border p-5",
        comment.premium
          ? "glass-panel border-secondary/40 shadow-[0_0_20px_rgba(0,209,255,0.1)]"
          : "bg-surface-container-low border-white/8",
        compact ? "rounded-[1.35rem] p-4" : "",
      )}
    >
      {comment.premium ? (
        <div className="absolute right-5 top-0 -translate-y-1/2 rounded-full bg-secondary px-3 py-1 shadow-[0_10px_20px_rgba(0,209,255,0.18)]">
          <div className="flex items-center gap-1">
            <Icon name="star" filled className="text-[0.85rem] text-on-secondary" />
            <span className="font-display text-[0.5rem] font-black uppercase tracking-[0.12em] text-on-secondary">
              Premium
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-4">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
          <ImageCard
            src={comment.avatar}
            alt={comment.author}
            className="h-full w-full"
            sizes="44px"
            imageClassName={comment.grayscale ? "object-cover grayscale" : "object-cover"}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">{comment.author}</div>
              <div className="mt-0.5 text-[0.66rem] font-medium text-on-surface-variant">{comment.time}</div>
            </div>
            <div
              className={cx(
                "rounded-md px-2 py-0.5 font-display text-[0.5rem] font-bold uppercase tracking-[0.16em]",
                toneClasses(comment.tone),
              )}
            >
              {comment.verdict}
            </div>
          </div>

          <p className={cx("text-sm leading-6 text-on-surface-variant", compact ? "text-[0.85rem] leading-6" : "")}>
            {comment.body}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {comment.actions.map((action) => (
              <CommentAction key={`${comment.id}-${action.label}`} action={action} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofPointRow({ item, rounded }: { item: ProofPointView; rounded: "top" | "bottom" | "single" }) {
  return (
    <div
      className={cx(
        "flex gap-5 bg-surface-container-high px-5 py-5 transition-colors duration-300 hover:bg-surface-bright/80",
        rounded === "top" ? "rounded-t-[1rem]" : "",
        rounded === "bottom" ? "rounded-b-[1rem]" : "",
        rounded === "single" ? "rounded-[1rem]" : "",
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-surface-container-highest">
        <Icon
          name={item.icon}
          filled={item.tone === "primary"}
          className={cx(
            "text-[1.35rem]",
            item.tone === "primary" ? "text-primary" : item.tone === "secondary" ? "text-secondary" : "text-tertiary",
          )}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-[1.05rem] font-bold tracking-[-0.04em] text-white">{item.title}</span>
          <span
            className={cx(
              "rounded-md px-2 py-0.5 font-display text-[0.5rem] font-bold uppercase tracking-[0.16em]",
              toneClasses(item.tone),
            )}
          >
            {item.badge}
          </span>
        </div>
        <p className="max-w-[40rem] text-[0.94rem] leading-7 text-on-surface-variant">{item.summary}</p>
        <div className="flex items-center gap-4 pt-1">
          <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {item.time}
          </span>
          <button
            type="button"
            className="font-display text-[0.54rem] font-bold uppercase tracking-[0.18em] text-secondary hover:underline"
          >
            {item.action}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileOverview({ profile }: { profile: KolProfileView }) {
  return (
    <div className="space-y-6">
      <SurfaceBlock className="px-5 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Icon name="grid_view" className="text-[1.05rem] text-secondary" />
          <h3 className="font-display text-[0.86rem] font-bold uppercase tracking-[0.12em] text-white">
            Reputation Heatmap
          </h3>
        </div>

        <div className="space-y-4 py-2 text-center font-display uppercase">
          {profile.mobileHeatmapWords.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {row.map((item) => (
                <span key={item.label} className={item.className}>
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </SurfaceBlock>

      <div className="space-y-4">
        {profile.summaryStats.map((stat) => (
          <SurfaceBlock key={stat.label} className="flex items-center justify-between px-5 py-5">
            <div>
              <div className="font-display text-[0.5rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
                {stat.label}
              </div>
              <div
                className={cx(
                  "mt-2 font-display text-[2rem] font-black tracking-[-0.06em]",
                  stat.tone === "primary" ? "text-primary" : "text-white",
                )}
              >
                {stat.value}
              </div>
            </div>
            <div
              className={cx(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                stat.tone === "primary"
                  ? "bg-primary/10 text-primary"
                  : stat.tone === "secondary"
                    ? "bg-secondary/10 text-secondary"
                    : "bg-surface-container-highest text-on-surface-variant",
              )}
            >
              <Icon name={stat.icon} className="text-[1.45rem]" />
            </div>
          </SurfaceBlock>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.03em] text-white [word-spacing:0.08em]">Community Verdict</h3>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-surface-container-highest px-3 py-2 font-display text-[0.54rem] font-bold uppercase tracking-[0.16em] text-white"
          >
            Sort: Newest
          </button>
        </div>

        <div className="space-y-4">
          {profile.comments.slice(0, 2).map((comment) => (
            <CommunityCommentCard key={comment.id} comment={comment} />
          ))}
          {profile.comments.length === 0 ? <EmptyBlock message="No community verdicts published yet." /> : null}
        </div>
      </section>
    </div>
  );
}

function MobileComments({ profile }: { profile: KolProfileView }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.03em] text-white [word-spacing:0.08em]">Community Verdict</h3>
        <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          {profile.comments.length} verdicts
        </span>
      </div>

      {profile.comments.map((comment) => (
        <CommunityCommentCard key={comment.id} comment={comment} compact />
      ))}

      {profile.comments.length === 0 ? <EmptyBlock message="No community verdicts published yet." compact /> : null}
    </div>
  );
}

function MobileActivity({ profile }: { profile: KolProfileView }) {
  return (
    <div className="space-y-3">
      {profile.proofPoints.map((item, index) => (
        <ProofPointRow
          key={item.id}
          item={item}
          rounded={profile.proofPoints.length === 1 ? "single" : index === 0 ? "top" : index === profile.proofPoints.length - 1 ? "bottom" : "single"}
        />
      ))}

      {profile.proofPoints.length === 0 ? <EmptyBlock message="No proof points recorded yet." /> : null}

      <SurfaceBlock className="space-y-4 px-5 py-5">
        <div className="font-display text-[0.72rem] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
          Activity Feed
        </div>
        {profile.activity.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div
              className={cx(
                "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                item.tone === "primary"
                  ? "bg-primary/10 text-primary"
                  : item.tone === "secondary"
                    ? "bg-secondary/10 text-secondary"
                    : "bg-tertiary/10 text-tertiary",
              )}
            >
              <Icon name={item.icon} className="text-[1.05rem]" />
            </div>
            <div>
              <div className="font-display text-[0.95rem] font-bold tracking-[-0.03em] text-white">{item.title}</div>
              <p className="mt-1 text-[0.84rem] leading-6 text-on-surface-variant">{item.detail}</p>
              <div className="mt-2 font-display text-[0.52rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                {item.time}
              </div>
            </div>
          </div>
        ))}
      </SurfaceBlock>
    </div>
  );
}

function DesktopOverview({
  profile,
  bullish,
  neutral,
  risk,
}: {
  profile: KolProfileView;
  bullish: number;
  neutral: number;
  risk: number;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-[1.25rem] border border-white/5 bg-[linear-gradient(180deg,rgba(14,24,18,0.94),rgba(10,18,15,0.98))] px-6 py-6 shadow-[0_24px_48px_rgba(0,0,0,0.32)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-[1.9rem] font-bold tracking-[-0.035em] text-white [word-spacing:0.08em]">Reputation Heatmap</h2>
          <span className="font-display text-[0.58rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
            Last 12 Months
          </span>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
          {profile.heatmap.flatMap((row, rowIndex) =>
            row.map((cell, cellIndex) => <HeatCell key={`${rowIndex}-${cellIndex}`} intensity={cell} />),
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-8">
        <section className="space-y-4">
          <div className="font-display text-[0.76rem] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
            Sentiment Distribution
          </div>
          <div className="flex h-12 overflow-hidden rounded-lg border border-white/5">
            <div
              aria-label={`Bullish ${bullish}%`}
              className="h-full bg-primary"
              style={{ width: `${bullish}%` }}
            />
            <div
              aria-label={`Neutral ${neutral}%`}
              className="h-full bg-surface-container-highest"
              style={{ width: `${neutral}%` }}
            />
            <div
              aria-label={`Risk ${risk}%`}
              className="h-full bg-tertiary"
              style={{ width: `${risk}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-label text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            <span>Bullish {bullish}%</span>
            <span>Neutral {neutral}%</span>
            <span>Risk {risk}%</span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="font-display text-[0.76rem] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
            Community Consensus
          </div>
          <div className="flex items-center gap-4">
            <div className="font-display text-[3.2rem] font-bold tracking-[-0.08em] text-white">
              {profile.kol.communityScore}
              <span className="ml-1 text-[1.15rem] font-medium text-on-surface-variant">/100</span>
            </div>
            <div>
              <div className="font-display text-[0.9rem] font-bold text-primary">
                {Number(profile.kol.communityScore) >= 75 ? "Strong Trust" : Number(profile.kol.communityScore) >= 55 ? "Mixed Signal" : "Risk Watch"}
              </div>
              <div className="mt-1 text-[0.76rem] text-on-surface-variant">{profile.kol.communityMeta}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-[1.9rem] font-bold tracking-[-0.035em] text-white [word-spacing:0.08em]">Recent Proof Points</h2>
        <div className="space-y-px rounded-[1rem] bg-white/5">
          {profile.proofPoints.map((item, index) => (
            <ProofPointRow
              key={item.id}
              item={item}
              rounded={profile.proofPoints.length === 1 ? "single" : index === 0 ? "top" : index === profile.proofPoints.length - 1 ? "bottom" : "single"}
            />
          ))}
        </div>
        {profile.proofPoints.length === 0 ? <EmptyBlock message="No proof points recorded yet." /> : null}
      </section>
    </div>
  );
}

function DesktopComments({ comments }: { comments: CommentView[] }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[1.9rem] font-bold tracking-[-0.035em] text-white [word-spacing:0.08em]">Community Verdict</h2>
        <button
          type="button"
          className="rounded-[0.85rem] border border-white/10 bg-surface-container-high px-4 py-2 font-display text-[0.56rem] font-bold uppercase tracking-[0.18em] text-white"
        >
          Sort: Newest
        </button>
      </div>

      <div className="space-y-4">
        {comments.map((comment, index) => (
          <CommunityCommentCard key={comment.id} comment={index === 0 ? comment : { ...comment, premium: false }} compact />
        ))}
        {comments.length === 0 ? <EmptyBlock message="No community verdicts published yet." compact /> : null}
      </div>
    </div>
  );
}

function DesktopActivity({ activity }: { activity: ActivityView[] }) {
  return (
    <div className="space-y-4">
      {activity.map((item) => (
        <div key={item.id} className="flex gap-5 rounded-[1.05rem] bg-surface-container-high px-5 py-5">
          <div
            className={cx(
              "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem]",
              item.tone === "primary"
                ? "bg-primary/10 text-primary"
                : item.tone === "secondary"
                  ? "bg-secondary/10 text-secondary"
                  : "bg-tertiary/10 text-tertiary",
            )}
          >
            <Icon name={item.icon} className="text-[1.3rem]" />
          </div>
          <div className="space-y-2">
            <div className="font-display text-[1.05rem] font-bold tracking-[-0.04em] text-white">{item.title}</div>
            <p className="max-w-[42rem] text-[0.94rem] leading-7 text-on-surface-variant">{item.detail}</p>
            <div className="font-display text-[0.56rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              {item.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KolProfileScreen({
  profile: initialProfile,
  feeAmount,
  initialModal = false,
}: {
  profile: KolProfileView;
  feeAmount: string;
  initialModal?: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [mobileTab, setMobileTab] = useState<MobileTab>("Overview");
  const commentsTabLabel = useMemo(() => `Verdicts (${profile.comments.length})`, [profile.comments.length]);
  const desktopTabs = useMemo(() => ["Overview", commentsTabLabel, "Activity"], [commentsTabLabel]);
  const [desktopTab, setDesktopTab] = useState<DesktopTab>("Overview");
  const [isVerifyClaimModalOpen, setIsVerifyClaimModalOpen] = useState(initialModal);
  const router = useRouter();
  const pathname = usePathname();
  const sentiment = getSentimentDistribution(profile);
  const desktopNameLines = splitDisplayName(profile.kol.displayName);
  const riskMessage = buildRiskMessage(profile);
  useEffect(() => {
    setIsVerifyClaimModalOpen(initialModal);
  }, [initialModal]);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (desktopTab !== "Overview" && desktopTab !== "Activity" && desktopTab !== commentsTabLabel) {
      setDesktopTab("Overview");
    }
  }, [commentsTabLabel, desktopTab]);

  function openVerifyClaimModal() {
    setIsVerifyClaimModalOpen(true);
    router.push(`${pathname}?modal=verify-claim`, { scroll: false });
  }

  function closeVerifyClaimModal() {
    setIsVerifyClaimModalOpen(false);
    router.replace(pathname, { scroll: false });
  }

  function handleCommentCreated(comment: CommentView) {
    setProfile((current) => {
      const existingIndex = current.comments.findIndex((entry) => entry.id === comment.id);
      const nextComments =
        existingIndex === -1
          ? [comment, ...current.comments]
          : current.comments.map((entry) => (entry.id === comment.id ? comment : entry));

      return {
        ...current,
        comments: nextComments,
        summaryStats:
          existingIndex === -1
            ? current.summaryStats.map((stat) => {
                if (stat.label !== "Total Comments") {
                  return stat;
                }

                const match = stat.value.match(/\d+/);
                if (!match) {
                  return stat;
                }

                return {
                  ...stat,
                  value: `${Number(match[0]) + 1}`,
                };
              })
            : current.summaryStats,
        activity:
          existingIndex === -1
            ? [
                {
                  id: `activity-${comment.id}`,
                  title: "Verdict submitted",
                  detail: comment.body,
                  time: "just now",
                  icon: "fact_check",
                  tone: comment.tone,
                },
                ...current.activity,
              ].slice(0, 3)
            : current.activity,
      };
    });
  }

  return (
    <>
      <MobileShell navKey={null} avatar={brandAvatar} className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-24 h-32 rounded-full bg-primary/5 blur-[90px]" />

        <section className="relative space-y-5">
          <div className="space-y-3 pt-1 text-center">
            <div className="relative mx-auto h-28 w-28">
              <div className="absolute inset-0 rounded-[1.55rem] bg-primary/12 blur-2xl" />
              <div className="relative h-full w-full overflow-hidden rounded-[1.55rem] border border-primary/24 shadow-surface">
                <ImageCard src={profile.kol.avatarUrl} alt={profile.kol.displayName} className="h-full w-full" sizes="128px" priority />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="rounded-full border border-secondary/20 bg-secondary-container/20 px-3 py-1 font-label text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-secondary">
                {profile.kol.verifiedLabel}
              </span>
              <Icon name="verified" filled className="text-[0.95rem] text-secondary" />
            </div>

            <div>
              <h1 className="font-display text-[2.1rem] font-black tracking-[-0.08em] text-white">{profile.kol.displayName}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">{profile.kol.role}</p>
            </div>

            <div className="mx-auto max-w-[11rem] overflow-hidden rounded-[1.25rem] border border-white/8 bg-surface-container-high px-5 py-3 shadow-surface">
              <div className="mb-1 font-label text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-primary">Verdict Score</div>
              <div className="relative flex items-end justify-center">
                <span className="font-display text-[3rem] font-black leading-none tracking-[-0.08em] text-primary">
                  {Math.round(profile.kol.score)}
                </span>
                <span className="pb-1 font-label text-[1rem] font-semibold text-primary/55">/100</span>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2">
                <Icon name="thumb_up" className="text-[0.95rem] text-primary" />
                <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.22em] text-primary">
                  {profile.kol.positive}% Positive Sentiment
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.22em] text-tertiary">
                  {profile.kol.negative}% Negative
                </span>
                <Icon name="thumb_down" className="text-[0.95rem] text-tertiary" />
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
              <div className="flex h-full">
                <div
                  className="bg-primary shadow-[0_0_15px_rgba(156,255,147,0.45)]"
                  style={{ width: `${profile.kol.positive}%` }}
                />
                <div className="bg-tertiary/70" style={{ width: `${profile.kol.negative}%` }} />
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={openVerifyClaimModal}
            className="kv-focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-primary/22 bg-primary/10 px-4 py-3.5 text-center font-label text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary transition-colors duration-200 hover:bg-primary hover:text-on-primary"
          >
            <Icon name="add_comment" className="text-[1.05rem]" />
            Submit Verdict / Verify Claim
          </button>

          <TabStrip tabs={MOBILE_TABS} active={mobileTab} onChange={(tab) => setMobileTab(tab as MobileTab)} className="gap-5" />

          <AnimatePresence mode="wait">
            <motion.div
              key={mobileTab}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            >
              {mobileTab === "Overview" ? (
                <MobileOverview profile={profile} />
              ) : mobileTab === "Verdicts" ? (
                <MobileComments profile={profile} />
              ) : (
                <MobileActivity profile={profile} />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </MobileShell>

      <DesktopShell
        navKey={null}
        avatar={brandAvatar}
        searchPlaceholder="Search KOL registry..."
        className="relative overflow-y-auto thin-scrollbar"
      >
        <div className="pointer-events-none absolute right-[-10rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-primary/4 blur-[130px]" />

        <section className="kv-page-tight relative">
          <div className="grid grid-cols-[16rem_minmax(0,1fr)_15rem] gap-5">
            <div className="space-y-5">
              <section className="rounded-[1.15rem] border border-white/8 bg-[linear-gradient(180deg,rgba(14,24,22,0.9),rgba(8,13,13,0.98))] p-4 shadow-surface">
                <div className="relative overflow-hidden rounded-[0.95rem]">
                  <ImageCard
                    src={profile.kol.avatarUrl}
                    alt={profile.kol.displayName}
                    className="aspect-square w-full"
                    sizes="300px"
                    priority
                    imageClassName="object-cover grayscale"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1.5">
                    <div className="flex items-center gap-1.5 font-label text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-on-primary">
                      <Icon name="verified" filled className="text-[0.95rem]" />
                      {profile.kol.verifiedLabel}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <h1 className="font-display text-[2.35rem] font-black leading-[0.92] tracking-[-0.08em] text-white">
                    {desktopNameLines[0]}
                    {desktopNameLines[1] ? (
                      <>
                        <br />
                        {desktopNameLines[1]}
                      </>
                    ) : null}
                  </h1>
                  <p className="mt-2 text-sm text-on-surface-variant">{profile.kol.handle}</p>
                </div>

                <div className="mt-6 border-t border-white/6 pt-6">
                  <div className="mb-2 flex items-end justify-between">
                    <span className="font-display text-[0.5rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
                      Verdict Score
                    </span>
                    <span className="font-display text-[2.25rem] font-black tracking-[-0.06em] text-primary">
                      {formatScore(profile.kol.score)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${profile.kol.score}%` }} />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-[0.6rem] bg-surface-container-lowest p-4">
                    <div className="font-display text-[0.48rem] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
                      Accurate Calls
                    </div>
                    <div className="mt-2 font-display text-[2rem] font-black tracking-[-0.06em] text-white">
                      {profile.kol.accurateCalls}
                    </div>
                  </div>
                  <div className="rounded-[0.6rem] bg-surface-container-lowest p-4">
                    <div className="font-display text-[0.48rem] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
                      Reputation
                    </div>
                    <div className="mt-2 font-display text-[2rem] font-black tracking-[-0.06em] text-secondary">
                      {profile.kol.reputation}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1rem] border border-white/8 bg-surface-container-low px-4 py-4">
                <div className="kv-label mb-4">
                  Core Networks
                </div>

                <div className="space-y-3">
                  {profile.kol.networks.map((network) => (
                    <div
                      key={network.name}
                      className="flex items-center justify-between rounded-[0.65rem] bg-surface-container-high px-4 py-3 transition-colors hover:bg-surface-bright"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          name={network.icon}
                          className={cx("text-[1.15rem]", network.tone === "primary" ? "text-primary" : "text-secondary")}
                        />
                        <span className="text-[0.95rem] text-white">{network.name}</span>
                      </div>
                      <span className="text-xs text-on-surface-variant">{network.meta}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <TabStrip tabs={desktopTabs} active={desktopTab} onChange={(tab) => setDesktopTab(tab as DesktopTab)} className="gap-6" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={desktopTab}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                >
                  {desktopTab === "Overview" ? (
                    <DesktopOverview profile={profile} bullish={sentiment.bullish} neutral={sentiment.neutral} risk={sentiment.risk} />
                  ) : desktopTab === commentsTabLabel ? (
                    <DesktopComments comments={profile.comments} />
                  ) : (
                    <DesktopActivity activity={profile.activity} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="space-y-5">
              <section className="kv-panel px-4 py-4">
                <h3 className="font-display text-[1.35rem] font-bold tracking-[-0.035em] text-white [word-spacing:0.08em]">Interaction Hub</h3>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={openVerifyClaimModal}
                    className="kv-focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-primary/22 bg-primary/10 px-4 py-3 font-label text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary hover:text-on-primary"
                  >
                    <Icon name="add_comment" className="text-[1rem]" />
                    Submit Verdict
                  </button>
                  <p className="text-[0.8rem] leading-6 text-on-surface-variant">
                    Submit a community claim with linked proof to update this profile&apos;s live registry record.
                  </p>
                </div>
              </section>

              <section className="rounded-[0.95rem] bg-transparent px-2 py-2">
                <div className="kv-label mb-4">
                  Top Endorsers
                </div>

                <div className="space-y-4">
                  {profile.endorsers.map((endorser: EndorserView) => (
                    <div key={endorser.name} className="flex items-center gap-4">
                      <div
                        className={cx(
                          "rounded-full border-2 p-0.5",
                          endorser.tone === "primary"
                            ? "border-primary/20"
                            : endorser.tone === "secondary"
                              ? "border-secondary/20"
                              : "border-white/8",
                        )}
                      >
                        <div className="relative h-10 w-10 overflow-hidden rounded-full">
                          <ImageCard src={endorser.avatar} alt={endorser.name} className="h-full w-full" sizes="40px" />
                        </div>
                      </div>
                      <div>
                        <div
                          className={cx(
                            "font-display text-[0.95rem] font-bold tracking-[-0.04em]",
                            endorser.tone === "primary"
                              ? "text-white hover:text-primary"
                              : endorser.tone === "secondary"
                                ? "text-white hover:text-secondary"
                                : "text-white hover:text-white/80",
                          )}
                        >
                          {endorser.name}
                        </div>
                        <div className="mt-1 text-[0.72rem] text-on-surface-variant">{endorser.score}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {profile.endorsers.length === 0 ? (
                  <p className="text-[0.72rem] text-on-surface-variant">No endorsers recorded yet.</p>
                ) : null}

                <Link
                  href={`/kol/${profile.kol.slug}`}
                  className="mt-6 inline-block font-display text-[0.56rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant transition-colors hover:text-white"
                >
                  View All Network Connections
                </Link>
              </section>

              <section className="rounded-[0.95rem] border border-tertiary/20 bg-tertiary/5 px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="warning" className="text-[0.95rem] text-tertiary" />
                  <span className="font-display text-[0.56rem] font-bold uppercase tracking-[0.24em] text-tertiary">
                    Risk Advisory
                  </span>
                </div>
                <p className="text-[0.86rem] leading-7 text-[#ffb1aa]">{riskMessage}</p>
              </section>
            </div>
          </div>
        </section>
      </DesktopShell>

      <VerifyClaimModal
        open={isVerifyClaimModalOpen}
        onClose={closeVerifyClaimModal}
        kolSlug={profile.kol.slug}
        feeAmount={feeAmount}
        onCommentCreated={handleCommentCreated}
      />
    </>
  );
}
