"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DesktopShell, MobileShell } from "@/components/app-shell";
import { GhostButton, Icon, ImageCard, SurfaceCard, TabStrip } from "@/components/ui";
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

function LeaderboardMobileRow({
  entry,
  rank,
}: {
  entry: LeaderboardEntryView;
  rank: string;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 rounded-[2rem] border border-white/5 px-4 py-4 transition-colors duration-300 hover:bg-surface-container-high">
      <div className="min-w-8 font-display text-[1.9rem] font-black italic tracking-[-0.08em] text-outline-variant/85">
        {rank}
      </div>
      <div className="relative h-18 w-18 overflow-hidden rounded-[1.15rem] ring-2 ring-primary/35">
        <ImageCard src={entry.image} alt={entry.handle} className="h-full w-full" sizes="72px" />
        {entry.verified ? (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 font-display text-[0.42rem] font-black uppercase tracking-[0.16em] text-on-primary">
            Verified
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[1.85rem] font-black tracking-[-0.06em] text-white">{entry.handle}</div>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={cx(
              "font-display text-[0.74rem] font-bold uppercase tracking-[0.14em]",
              entry.trendTone === "primary"
                ? "text-primary"
                : entry.trendTone === "secondary"
                  ? "text-secondary"
                  : "text-tertiary",
            )}
          >
            {entry.trendLabel}
          </span>
          <span className="font-display text-[0.74rem] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            {entry.flowLabel}
          </span>
        </div>
      </div>
      <Link
        href={`/kol/${entry.slug}`}
        className="rounded-[1rem] border border-white/10 bg-surface-container-highest px-4 py-3 font-display text-[0.66rem] font-bold uppercase tracking-[0.2em] text-white"
      >
        View
      </Link>
    </div>
  );
}

function LeaderboardMobileSkeleton({ rank }: { rank: string }) {
  return (
    <div className="glass-panel flex items-center gap-4 rounded-[2rem] border border-white/5 px-4 py-4">
      <div className="min-w-8 font-display text-[1.9rem] font-black italic tracking-[-0.08em] text-outline-variant/45">
        {rank}
      </div>
      <div className="h-18 w-18 rounded-[1.15rem] bg-surface-container-highest/70 motion-safe:animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-7 w-32 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="h-4 w-40 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
      </div>
      <div className="h-11 w-18 rounded-[1rem] bg-surface-container-highest/70 motion-safe:animate-pulse" />
    </div>
  );
}

function DesktopLeaderboardRow({
  entry,
  rank,
}: {
  entry: LeaderboardEntryView;
  rank: string;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_200px_200px_160px] items-center gap-4 px-8 py-6 transition-colors duration-300 hover:bg-white/[0.02]">
      <div className="font-display text-[1.9rem] font-black tracking-[-0.06em] text-on-surface/55">{rank}</div>

      <div className="flex items-center gap-4">
        <div
          className={cx(
            "relative h-12 w-12 overflow-hidden rounded-full border-2",
            entry.muted ? "border-outline-variant/30" : "border-primary-dim/30",
          )}
        >
          <ImageCard src={entry.image} alt={entry.handle} className="h-full w-full" sizes="48px" />
        </div>
        <div>
          <div className="font-display text-[1.15rem] font-black tracking-[-0.05em] text-white">{entry.handle}</div>
          <div className="mt-1 text-sm leading-5 text-on-surface-variant">{entry.subtitle}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-end gap-2">
          <div className={cx("font-display text-[2rem] font-black tracking-[-0.06em]", entry.muted ? "text-white" : "text-primary")}>
            {entry.trustScore}
          </div>
          <div className="flex h-6 items-end gap-[3px] pb-[2px]">
            {entry.sparkline.map((bar, idx) => (
              <span
                key={`${entry.slug}-${idx}`}
                className={cx("w-1 rounded-t-sm", entry.muted ? "bg-white/20" : "bg-primary/75")}
                style={{ height: `${bar}%` }}
              />
            ))}
          </div>
        </div>
        <div
          className={cx(
            "font-display text-[0.52rem] font-bold uppercase tracking-[0.22em]",
            rank === "01" || rank === "02" ? "text-primary-dim" : "text-on-surface-variant",
          )}
        >
          {entry.tier}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-display text-[0.5rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          <span>Bullish</span>
          <span>{entry.bullishPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
          <div className="flex h-full">
            <div className="bg-primary" style={{ width: `${entry.bullishPercent}%` }} />
            <div className="bg-tertiary" style={{ width: `${100 - entry.bullishPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="text-right">
        <Link
          href={`/kol/${entry.slug}`}
          className="rounded-full border border-outline-variant px-5 py-2.5 font-display text-[0.56rem] font-bold uppercase tracking-[0.24em] text-white transition-colors duration-300 hover:bg-white hover:text-black"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

function DesktopLeaderboardSkeleton({ rank }: { rank: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr_200px_200px_160px] items-center gap-4 px-8 py-6">
      <div className="font-display text-[1.9rem] font-black tracking-[-0.06em] text-on-surface/35">{rank}</div>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
          <div className="h-4 w-44 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-8 w-24 rounded-md bg-surface-container-highest/70 motion-safe:animate-pulse" />
        <div className="h-3 w-20 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-md bg-surface-container-highest/40 motion-safe:animate-pulse" />
        <div className="h-1.5 w-full rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
      </div>
      <div className="ml-auto h-10 w-28 rounded-full bg-surface-container-highest/70 motion-safe:animate-pulse" />
    </div>
  );
}

function StatusPanel({ message }: { message: string }) {
  return (
    <div className="glass-panel rounded-[2rem] border border-white/5 px-5 py-6 text-center">
      <p className="font-display text-[0.76rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{message}</p>
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
        <section className="space-y-7 pt-1">
          <header className="space-y-3">
            <h1 className="font-display text-[3.15rem] font-black uppercase leading-[0.92] tracking-[-0.08em] text-white">
              Global Trust
              <br />
              <span className="text-primary">Ranking</span>
            </h1>
            <p className="max-w-[19rem] text-[1.05rem] leading-8 text-on-surface-variant">
              Real-time verification of influencer reputation powered by cryptographic proof and community sentiment.
            </p>
          </header>

          <TabStrip
            tabs={[...tabs]}
            active={activeTab}
            onChange={(tab) => setActiveTab(tab as UiTab)}
            compact
            className="w-full justify-between rounded-[1.15rem] p-1.5"
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
                    className="rounded-full border border-secondary/20 bg-secondary/10 px-5 py-3 font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-secondary transition-colors duration-300 hover:bg-secondary/16"
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
                  <GhostButton href="/add" className="rounded-full border-secondary/20 bg-secondary/10 px-5 py-3 text-secondary">
                    Add KOL
                  </GhostButton>
                </div>
              </div>
            ) : null}

            {!error && mobileEntries.map((entry, index) => <LeaderboardMobileRow key={entry.slug} entry={entry} rank={rankLabel(index)} />)}
          </div>
        </section>
      </MobileShell>

      <DesktopShell
        navKey="leaderboard"
        avatar={brandAvatar}
        searchPlaceholder="Search Analysts..."
        className="overflow-y-auto thin-scrollbar"
      >
        <section className="space-y-8 pb-8">
          <TabStrip
            tabs={[...tabs]}
            active={activeTab}
            onChange={(tab) => setActiveTab(tab as UiTab)}
            compact
            className="w-fit rounded-[1rem] p-1.5"
          />

          <div className="grid grid-cols-4 gap-6">
            {stats.map((card) => (
              <SurfaceCard key={card.label} className="overflow-hidden rounded-[1rem] bg-surface-container-low px-6 py-5">
                <div
                  className={cx(
                    "absolute inset-y-0 left-0 w-1",
                    card.tone === "primary"
                      ? "bg-primary/55"
                      : card.tone === "secondary"
                        ? "bg-secondary/55"
                        : card.tone === "tertiary"
                          ? "bg-tertiary/55"
                          : "bg-white/15",
                  )}
                />
                <div className="font-display text-[0.54rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
                  {card.label}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="font-display text-[2.2rem] font-black tracking-[-0.06em] text-white">{card.value}</div>
                  <div
                    className={cx(
                      "pb-1 font-display text-[0.68rem] font-bold uppercase tracking-[0.16em]",
                      card.tone === "primary"
                        ? "text-primary"
                        : card.tone === "tertiary"
                          ? "text-tertiary"
                          : "text-on-surface-variant",
                    )}
                  >
                    {card.meta}
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>

          <SurfaceCard className="overflow-hidden rounded-[1rem] border border-white/5 bg-surface-container-low shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
            <div className="grid grid-cols-[80px_1fr_200px_200px_160px] gap-4 border-b border-white/5 bg-surface-container-high/45 px-8 py-6">
              {["Rank", "Analyst Profile", "Verdict Score", "Sentiment Matrix", "Action"].map((label) => (
                <div
                  key={label}
                  className={cx(
                    "font-display text-[0.54rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant",
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
                <DesktopLeaderboardRow key={entry.slug} entry={entry} rank={rankLabel(index)} />
              ))}

              {!isLoading && (error || desktopEntries.length === 0) ? (
                <div className="px-8 py-10 text-center">
                  <p className="font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    {error ?? "No ranked analysts available yet."}
                  </p>
                  <div className="mt-5 flex justify-center">
                    {error ? (
                      <button
                        type="button"
                        onClick={() => setReloadNonce((current) => current + 1)}
                        className="rounded-full border border-secondary/20 bg-secondary/10 px-5 py-3 font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-secondary transition-colors duration-300 hover:bg-secondary/16"
                      >
                        Retry Ranking
                      </button>
                    ) : (
                      <GhostButton href="/add" className="rounded-full border-secondary/20 bg-secondary/10 px-5 py-3 text-secondary">
                        Add KOL
                      </GhostButton>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 bg-surface-container-high/25 px-8 py-6">
              <p className="text-sm text-on-surface-variant">
                Showing <span className="text-white">1 - {desktopEntries.length}</span> of {snapshot?.total ?? 0} ranked analysts
              </p>
              <div className="flex items-center gap-2">
                {["chevron_left", "1", "2", "3", "chevron_right"].map((item) =>
                  item.includes("chevron") ? (
                    <button
                      key={item}
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-[0.7rem] border border-white/5 text-on-surface-variant transition-colors duration-300 hover:bg-white/5"
                    >
                      <Icon name={item} className="text-[1rem]" />
                    </button>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={cx(
                        "h-10 w-10 rounded-[0.7rem] border font-display text-[0.62rem] font-bold uppercase tracking-[0.18em]",
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
          className="liquid-neon-primary primary-glow fixed bottom-10 right-10 flex h-14 w-14 items-center justify-center rounded-full"
        >
          <Icon name="add" filled className="text-[1.5rem]" />
        </Link>
      </DesktopShell>
    </>
  );
}
