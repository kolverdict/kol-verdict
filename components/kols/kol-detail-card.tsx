"use client";

import type { KolProfileDetail } from "@/lib/types/api";
import type { HomeCardView } from "@/lib/types/domain";
import { Icon, ImageCard, Pill } from "@/components/ui";
import { KolMetricsGrid } from "@/components/kols/kol-metrics-grid";
import { KolSignalsList } from "@/components/kols/kol-signals-list";
import { KolVerdictPanel } from "@/components/kols/kol-verdict-panel";
import { cx } from "@/lib/utils";

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatMetricValue(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return compactFormatter.format(value);
}

export function KolDetailCard({
  detail,
  reasonTags,
  layout,
  onCollapse,
}: {
  detail: KolProfileDetail;
  reasonTags: HomeCardView["reasonTags"];
  layout: "mobile" | "desktop";
  onCollapse: () => void;
}) {
  const isDesktop = layout === "desktop";
  const sourceNote =
    detail.sourceMeta.isPlaceholder || detail.sourceMeta.dataSource === "synthetic_fallback"
      ? "Placeholder intelligence"
      : null;
  const metricItems = [
    { label: "Followers", value: formatMetricValue(detail.followersCount), icon: "groups" },
    { label: "Following", value: formatMetricValue(detail.followingCount), icon: "person_add" },
    { label: "Tweets", value: formatMetricValue(detail.tweetsCount), icon: "forum" },
    { label: "Verified Followers", value: formatMetricValue(detail.verifiedFollowersCount), icon: "shield" },
  ];

  return (
    <div
      onClick={onCollapse}
      className={cx(
        "relative overflow-hidden rounded-[1.8rem] border border-white/8 bg-surface-container-high shadow-surface-lg transition-[box-shadow,border-color] duration-300 cursor-pointer",
        isDesktop ? "w-full p-6" : "w-full p-4",
      )}
      title="Click to return to the summary verdict view"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(48,200,232,0.08),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(146,245,143,0.08),transparent_28%),linear-gradient(180deg,rgba(21,26,30,0.98),rgba(9,11,13,1))]" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cx(
              "flex gap-4",
              isDesktop ? "items-center" : "items-start",
            )}
          >
            <div className={cx("relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-surface-container-highest", isDesktop ? "h-24 w-24" : "h-20 w-20")}>
              <ImageCard
                src={detail.avatarUrl}
                alt={`${detail.displayName} avatar`}
                priority
                sizes={isDesktop ? "192px" : "160px"}
                className="h-full w-full"
                imageClassName="object-cover object-center grayscale-[8%] contrast-110"
                fallbackSrc="/default-avatar.svg"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={cx(
                    "font-display font-black leading-[0.92] tracking-[-0.07em] text-white",
                    isDesktop ? "text-[2.6rem]" : "text-[1.6rem]",
                  )}
                >
                  {detail.displayName}
                </h2>
                {detail.verified ? (
                  <Icon name="verified" filled className={cx("text-secondary", isDesktop ? "text-[1.3rem]" : "text-[1.15rem]")} />
                ) : null}
              </div>
              <p className={cx("mt-1 font-label font-semibold uppercase tracking-[0.14em] text-secondary", isDesktop ? "text-[0.72rem]" : "text-[0.6rem]")}>
                {detail.handle}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pill tone={detail.verified ? "primary" : "neutral"} className="border-white/10 bg-black/18 text-white">
                  <span className={cx("h-2 w-2 rounded-full", detail.verified ? "bg-primary" : "bg-on-surface-variant")} />
                  {detail.verified ? "Verified profile" : "Registry tracked"}
                </Pill>
                <Pill tone={detail.trustScore !== null && detail.trustScore >= 70 ? "primary" : "secondary"} className="bg-primary/12 text-primary">
                  Score {detail.trustScore !== null ? `${detail.trustScore}/100` : "N/A"}
                </Pill>
                {detail.activityLabel ? <Pill className="bg-white/6 text-on-surface-variant">{detail.activityLabel}</Pill> : null}
                {sourceNote ? <Pill className="bg-white/6 text-on-surface-variant">{sourceNote}</Pill> : null}
              </div>
              {detail.bio ? (
                <p className={cx("mt-3 max-w-[34rem] text-on-surface-variant", isDesktop ? "text-[0.88rem] leading-6" : "text-[0.8rem] leading-6")}>
                  {detail.bio}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCollapse();
            }}
            className="kv-focus-ring inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 font-label text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors duration-200 hover:bg-white/8 hover:text-white"
            aria-label="Back to summary view"
          >
            <Icon name="arrow_back" className="text-[0.95rem]" />
            <span>{isDesktop ? "Back to Summary" : "Back"}</span>
          </button>
        </div>

        <div className={cx("mt-5", isDesktop ? "grid grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] gap-5" : "space-y-4")}>
          <div className="space-y-4">
            <KolMetricsGrid items={metricItems} compact={!isDesktop} />
            <KolVerdictPanel
              verdictTitle={detail.verdictLabel}
              verdictSummary={detail.verdictSummary}
              reasoningPoints={detail.reasoningPoints}
              trustScore={detail.trustScore}
              reasonTags={reasonTags}
              compact={!isDesktop}
            />
          </div>

          <KolSignalsList signals={detail.recentSignals} compact={!isDesktop} />
        </div>
      </div>
    </div>
  );
}
