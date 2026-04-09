"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { GhostButton, Icon, ImageCard, SectionHeader, StatTile, SurfaceCard, TabStrip } from "@/components/ui";
import { parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import { brandAvatar } from "@/lib/mock-data";
import type { LeaderboardResponse } from "@/lib/types/api";
import type { LeaderboardEntryView, LeaderboardSnapshot, LeaderboardTab, StatCardView } from "@/lib/types/domain";
import { cx } from "@/lib/utils";

const tabs = ["Trusted", "Hated", "Trending"] as const;

type UiTab = (typeof tabs)[number];
type SnapshotCache = Partial<Record<LeaderboardTab, LeaderboardSnapshot>>;

const tabMap: Record<UiTab, LeaderboardTab> = {
  Trusted: "trusted",
  Hated: "hated",
  Trending: "trending",
};

const skeletonStats: StatCardView[] = [
  { label: "Network Veracity", value: "--", meta: "Live Avg", tone: "primary" },
  { label: "Active Oracles", value: "--", meta: "Registry", tone: "secondary" },
  { label: "Total Scams Flagged", value: "--", meta: "Community", tone: "tertiary" },
  { label: "Reputation Minted", value: "--", meta: "Profiles", tone: "neutral" },
];

function rankLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function trendArrowIcon(tab: LeaderboardTab) {
  return tab === "hated" ? "arrow_downward" : "arrow_upward";
}

function trendAccentClass(tab: LeaderboardTab, muted?: boolean) {
  if (tab === "hated") {
    return muted ? "text-tertiary/70" : "text-tertiary";
  }

  return muted ? "text-primary/70" : "text-primary";
}

function MiniSparkline({
  values,
  tab,
  muted,
  className,
}: {
  values: number[];
  tab: LeaderboardTab;
  muted?: boolean;
  className?: string;
}) {
  const width = 72;
  const height = 24;
  const inset = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const strokeClassName =
    tab === "hated"
      ? muted
        ? "text-tertiary/65"
        : "text-tertiary"
      : muted
        ? "text-primary/65"
        : "text-primary";
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : inset + (index / (values.length - 1)) * (width - inset * 2);
      const y = height - inset - ((value - min) / range) * (height - inset * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const lastX = values.length === 1 ? width / 2 : inset + (width - inset * 2);
  const lastY = height - inset - ((values[values.length - 1] - min) / range) * (height - inset * 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cx("overflow-visible", strokeClassName, className)}
    >
      <path d={`M ${inset} ${height - inset} H ${width - inset}`} className="stroke-current/20" strokeWidth="1.5" />
      <polyline
        fill="none"
        points={points}
        className="stroke-current"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" className="fill-current" />
    </svg>
  );
}

function LeaderboardMobileRow({
  entry,
  rank,
  tab,
}: {
  entry: LeaderboardEntryView;
  rank: string;
  tab: LeaderboardTab;
}) {
  return (
    <div className="kv-card grid grid-cols-[2.4rem_3.75rem_1fr_auto] items-center gap-3 px-4 py-4 transition-colors duration-200 hover:bg-surface-container-high">
      <div className="font-label text-[1.1rem] font-semibold tracking-[-0.04em] text-outline">
        {rank}
      </div>
      <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-primary/25 bg-surface-container-highest">
        <ImageCard
          src={entry.image}
          alt={`${entry.displayName ?? entry.handle} avatar`}
          className="h-full w-full"
          sizes="72px"
          fallbackSrc="/default-avatar.svg"
        />
        {entry.verified ? (
          <div className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface-container-high" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[1.25rem] font-bold tracking-[-0.055em] text-white">{entry.handle}</div>
        <div className="mt-2 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-surface-container-highest/65 px-3 py-1.5">
            <Icon name={trendArrowIcon(tab)} className={cx("text-[0.95rem]", trendAccentClass(tab, entry.muted))} />
            <span className={cx("font-display text-[1rem] font-bold tracking-[-0.05em] tabular-nums", entry.muted ? "text-white" : "text-primary")}>
              {entry.trustScore}
            </span>
            <MiniSparkline values={entry.sparkline} tab={tab} muted={entry.muted} className="h-5 w-16" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cx(
              "font-label text-[0.6rem] font-semibold uppercase tracking-[0.12em]",
              entry.trendTone === "primary"
                ? "text-primary"
                : entry.trendTone === "secondary"
                  ? "text-secondary"
                  : "text-tertiary",
            )}
          >
            {entry.trendLabel}
          </span>
          <span className="font-label text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            {entry.flowLabel}
          </span>
          <span className="font-label text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            {entry.verdictCountLabel}
          </span>
        </div>
      </div>
      <Link
        href={`/kol/${entry.slug}`}
        className="kv-focus-ring rounded-xl border border-white/10 bg-surface-container-highest px-3 py-2.5 font-label text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white"
      >
        View
      </Link>
    </div>
  );
}

function LeaderboardMobileSkeleton({ rank }: { rank: string }) {
  return (
    <div className="kv-card grid grid-cols-[2.4rem_3.75rem_1fr_auto] items-center gap-3 px-4 py-4">
      <div className="font-label text-[1.1rem] font-semibold tracking-[-0.04em] text-outline-variant/65">
        {rank}
      </div>
      <div className="h-14 w-14 rounded-xl bg-surface-container-highest/70 motion-safe:animate-pulse" />
      <div className="flex-1 space-y-2.5">
        <div className="h-5 w-32 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="h-8 w-36 rounded-full bg-surface-container-highest/60 motion-safe:animate-pulse" />
        <div className="h-3 w-40 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
      </div>
      <div className="h-10 w-14 rounded-xl bg-surface-container-highest/70 motion-safe:animate-pulse" />
    </div>
  );
}

function DesktopLeaderboardRow({
  entry,
  rank,
  tab,
}: {
  entry: LeaderboardEntryView;
  rank: string;
  tab: LeaderboardTab;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr_180px_190px_150px] items-center gap-4 px-6 py-5 transition-colors duration-200 hover:bg-white/[0.025]">
      <div className="font-label text-[1.25rem] font-semibold tracking-[-0.04em] text-on-surface/55">{rank}</div>

      <div className="flex items-center gap-4">
        <div
          className={cx(
            "relative h-12 w-12 overflow-hidden rounded-full border-2",
            entry.muted ? "border-outline-variant/30" : "border-primary-dim/30",
          )}
        >
          <ImageCard
            src={entry.image}
            alt={`${entry.displayName ?? entry.handle} avatar`}
            className="h-full w-full"
            sizes="48px"
            fallbackSrc="/default-avatar.svg"
          />
        </div>
        <div>
          <div className="font-display text-[1.05rem] font-bold tracking-[-0.05em] text-white">{entry.handle}</div>
          <div className="mt-1 text-sm leading-5 text-on-surface-variant">{entry.subtitle}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Icon name={trendArrowIcon(tab)} className={cx("text-[1rem]", trendAccentClass(tab, entry.muted))} />
          <div className={cx("font-display text-[1.7rem] font-bold tracking-[-0.06em] tabular-nums", entry.muted ? "text-white" : "text-primary")}>
            {entry.trustScore}
          </div>
          <MiniSparkline values={entry.sparkline} tab={tab} muted={entry.muted} className="h-7 w-[4.6rem]" />
        </div>
        <div
          className={cx(
            "font-label text-[0.52rem] font-semibold uppercase tracking-[0.14em]",
            rank === "01" || rank === "02" ? "text-primary-dim" : "text-on-surface-variant",
          )}
        >
          {entry.tier}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-label text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          <span>Bullish</span>
          <span>{entry.bullishPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
          <div className="flex h-full">
            <div className="bg-primary" style={{ width: `${entry.bullishPercent}%` }} />
            <div className="bg-tertiary" style={{ width: `${100 - entry.bullishPercent}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between font-label text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          <span>Total Verdicts</span>
          <span className="text-white">{entry.verdictCountLabel}</span>
        </div>
      </div>

      <div className="text-right">
        <Link
          href={`/kol/${entry.slug}`}
          className="kv-focus-ring rounded-xl border border-outline-variant/70 px-4 py-2.5 font-label text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-white hover:text-black"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

function DesktopLeaderboardSkeleton({ rank }: { rank: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr_180px_190px_150px] items-center gap-4 px-6 py-5">
      <div className="font-label text-[1.25rem] font-semibold tracking-[-0.04em] text-on-surface/35">{rank}</div>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
          <div className="h-4 w-44 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
          <div className="h-6 w-18 rounded-full bg-surface-container-highest/50 motion-safe:animate-pulse" />
        </div>
        <div className="h-3 w-20 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
        <div className="h-1.5 w-full rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="h-3 w-24 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
      </div>
      <div className="ml-auto h-10 w-28 rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
    </div>
  );
}

function StatusPanel({ message }: { message: string }) {
  return (
    <div className="kv-card px-5 py-6 text-center">
      <p className="font-label text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{message}</p>
    </div>
  );
}

export function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<UiTab>("Trusted");
  const [snapshots, setSnapshots] = useState<SnapshotCache>({});
  const [loadingTab, setLoadingTab] = useState<LeaderboardTab | null>(tabMap.Trusted);
  const [errorByTab, setErrorByTab] = useState<Partial<Record<LeaderboardTab, string>>>({});
  const [reloadNonce, setReloadNonce] = useState(0);

  const backendTab = tabMap[activeTab];
  const snapshot = snapshots[backendTab];
  const isLoading = loadingTab === backendTab;
  const error = errorByTab[backendTab];
  const mobileEntries = snapshot?.entries.slice(0, 4) ?? [];
  const desktopEntries = snapshot?.entries.slice(0, 5) ?? [];
  const stats = snapshot?.stats ?? skeletonStats;
  useEffect(() => {
    if (snapshots[backendTab]) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadSnapshot() {
      setLoadingTab(backendTab);
      setErrorByTab((current) => ({ ...current, [backendTab]: undefined }));

      try {
        const response = await fetch(`/api/leaderboard?tab=${backendTab}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await parseApiResponse<LeaderboardResponse>(response);

        if (!active) {
          return;
        }

        setSnapshots((current) => ({
          ...current,
          [backendTab]: result.snapshot,
        }));
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setErrorByTab((current) => ({
          ...current,
          [backendTab]: toUserFacingApiError(error, "Unable to load leaderboard."),
        }));
      } finally {
        if (active) {
          setLoadingTab((current) => (current === backendTab ? null : current));
        }
      }
    }

    void loadSnapshot();

    return () => {
      active = false;
      controller.abort();
    };
  }, [backendTab, reloadNonce, snapshots]);

  return (
    <>
      <MobileShell navKey="leaderboard" avatar={brandAvatar}>
        <section className="space-y-5 pt-1">
          <header className="space-y-3">
            <div className="kv-label text-secondary">Leaderboard</div>
            <h1 className="font-display text-[2.45rem] font-bold uppercase leading-[0.95] tracking-[-0.075em] text-white">
              Global Trust <span className="text-primary">Ranking</span>
            </h1>
            <p className="max-w-[22rem] text-sm leading-6 text-on-surface-variant">
              A live read on reputation, sentiment, and verdict volume across tracked KOLs.
            </p>
          </header>

          <TabStrip
            tabs={[...tabs]}
            active={activeTab}
            onChange={(tab) => setActiveTab(tab as UiTab)}
            compact
            className="w-full justify-between rounded-xl p-1.5"
          />

          <div className="space-y-4 pb-2">
            {isLoading && !snapshot ? Array.from({ length: 4 }, (_, index) => <LeaderboardMobileSkeleton key={index} rank={rankLabel(index)} />) : null}

            {!isLoading && error ? (
              <div className="space-y-3">
                <StatusPanel message={error} />
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setReloadNonce((current) => current + 1)}
                    className="kv-focus-ring rounded-xl border border-secondary/20 bg-secondary/10 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-secondary transition-colors duration-200 hover:bg-secondary/16"
                  >
                    Retry Ranking
                  </button>
                </div>
              </div>
            ) : null}

            {!isLoading && !error && mobileEntries.length === 0 ? (
              <div className="space-y-3">
                <StatusPanel message="No ranked analysts available yet." />
                <div className="flex justify-center">
                  <GhostButton href="/add" className="rounded-xl border-secondary/20 bg-secondary/10 px-5 py-3 text-secondary">
                    Add KOL
                  </GhostButton>
                </div>
              </div>
            ) : null}

            {!error && mobileEntries.map((entry, index) => (
              <LeaderboardMobileRow key={entry.slug} entry={entry} rank={rankLabel(index)} tab={backendTab} />
            ))}
          </div>
        </section>
      </MobileShell>

      <DesktopShell
        navKey="leaderboard"
        avatar={brandAvatar}
        searchPlaceholder="Search Analysts..."
        className="overflow-y-auto thin-scrollbar"
      >
        <section className="kv-page space-y-6">
          <SectionHeader
            eyebrow="Reputation Market"
            title="Leaderboard"
            copy="Ranked KOL reputation signals with sentiment and verdict volume in one compact view."
            action={
              <TabStrip
                tabs={[...tabs]}
                active={activeTab}
                onChange={(tab) => setActiveTab(tab as UiTab)}
                compact
                className="w-fit rounded-xl p-1.5"
              />
            }
          />

          <div className="grid grid-cols-4 gap-4">
            {stats.map((card) => (
              <StatTile key={card.label} label={card.label} value={card.value} meta={card.meta} tone={card.tone} />
            ))}
          </div>

          <SurfaceCard className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-surface-container-low shadow-surface">
            <div className="grid grid-cols-[64px_1fr_180px_190px_150px] gap-4 border-b border-white/8 bg-surface-container-high/45 px-6 py-4">
              {["Rank", "Analyst Profile", "Verdict Score", "Sentiment Matrix", "Action"].map((label) => (
                <div
                  key={label}
                  className={cx(
                    "font-label text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant",
                    label === "Action" ? "text-right" : "",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="divide-y divide-white/5">
              {isLoading && !snapshot ? Array.from({ length: 5 }, (_, index) => <DesktopLeaderboardSkeleton key={index} rank={rankLabel(index)} />) : null}

              {!isLoading && !error && desktopEntries.map((entry, index) => (
                <DesktopLeaderboardRow key={entry.slug} entry={entry} rank={rankLabel(index)} tab={backendTab} />
              ))}

              {!isLoading && (error || desktopEntries.length === 0) ? (
                <div className="px-8 py-10 text-center">
                  <p className="font-label text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    {error ?? "No ranked analysts available yet."}
                  </p>
                  <div className="mt-5 flex justify-center">
                    {error ? (
                      <button
                        type="button"
                        onClick={() => setReloadNonce((current) => current + 1)}
                        className="kv-focus-ring rounded-xl border border-secondary/20 bg-secondary/10 px-5 py-3 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-secondary transition-colors duration-200 hover:bg-secondary/16"
                      >
                        Retry Ranking
                      </button>
                    ) : (
                      <GhostButton href="/add" className="rounded-xl border-secondary/20 bg-secondary/10 px-5 py-3 text-secondary">
                        Add KOL
                      </GhostButton>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-white/8 bg-surface-container-high/25 px-6 py-4">
              <p className="text-sm text-on-surface-variant">
                Showing <span className="text-white">1 - {desktopEntries.length}</span> of {snapshot?.total ?? 0} ranked analysts
              </p>
              <div className="flex items-center gap-2">
                {["chevron_left", "1", "2", "3", "chevron_right"].map((item) =>
                  item.includes("chevron") ? (
                    <button
                      key={item}
                      type="button"
                      className="kv-focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 text-on-surface-variant transition-colors duration-200 hover:bg-white/5"
                    >
                      <Icon name={item} className="text-[1rem]" />
                    </button>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={cx(
                        "kv-focus-ring h-10 w-10 rounded-xl border font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em]",
                        item === "1" ? "border-primary/50 text-primary" : "border-white/5 text-on-surface-variant hover:text-white",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            </div>
          </SurfaceCard>
        </section>

        <Link
          href="/add"
          className="kv-focus-ring fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary text-on-primary shadow-surface transition-transform hover:-translate-y-0.5"
        >
          <Icon name="add" filled className="text-[1.5rem]" />
        </Link>
      </DesktopShell>
    </>
  );
}
