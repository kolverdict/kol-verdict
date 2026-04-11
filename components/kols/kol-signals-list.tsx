import type { KolProfileDetail } from "@/lib/types/api";
import { cx } from "@/lib/utils";

function recommendationToneClass(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";

  if (["constructive", "low risk", "confirmed"].some((token) => normalized.includes(token))) {
    return "text-primary";
  }

  if (["watch", "moderate", "mixed"].some((token) => normalized.includes(token))) {
    return "text-secondary";
  }

  if (["risk", "caution", "placeholder"].some((token) => normalized.includes(token))) {
    return "text-tertiary";
  }

  return "text-on-surface-variant";
}

function formatSignalTime(publishedAt: string | null) {
  if (!publishedAt) {
    return "Pending";
  }

  const timestamp = new Date(publishedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return "Pending";
  }

  const diff = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Math.abs(diff) < hour) {
    return formatter.format(Math.round(diff / minute), "minute");
  }

  if (Math.abs(diff) < day) {
    return formatter.format(Math.round(diff / hour), "hour");
  }

  return formatter.format(Math.round(diff / day), "day");
}

export function KolSignalsList({
  signals,
  compact = false,
}: {
  signals: KolProfileDetail["recentSignals"];
  compact?: boolean;
}) {
  return (
    <section className={cx("rounded-[1.35rem] border border-white/8 bg-surface-container-low/78", compact ? "px-4 py-4" : "px-5 py-5")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={cx("font-display font-bold tracking-[-0.04em] text-white", compact ? "text-[1.1rem]" : "text-[1.35rem]")}>
          Recent Signals
        </h3>
        <span className="font-label text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/70">
          Intelligence Feed
        </span>
      </div>

      <div className="mt-4 divide-y divide-white/8">
        {signals.length === 0 ? (
          <div className={cx("text-on-surface-variant", compact ? "py-3 text-[0.8rem] leading-6" : "py-4 text-[0.88rem] leading-6")}>
            More profile intelligence coming soon.
          </div>
        ) : null}
        {signals.map((signal) => (
          <div key={signal.id} className={cx("grid gap-2", compact ? "py-3" : "py-4", compact ? "grid-cols-1" : "grid-cols-[1fr_auto] items-center")}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-secondary">
                  {signal.signalCode ?? "Signal"}
                </span>
                <h4 className={cx("font-semibold text-white", compact ? "text-[0.86rem]" : "text-[0.9rem]")}>{signal.title}</h4>
              </div>
              <p className={cx("mt-1 font-label font-medium uppercase tracking-[0.12em]", compact ? "text-[0.56rem]" : "text-[0.6rem]", recommendationToneClass(signal.statusLabel ?? signal.impactLabel))}>
                {signal.statusLabel ?? signal.impactLabel ?? "Awaiting signal metadata"}
              </p>
              <p className={cx("mt-2 text-on-surface-variant", compact ? "text-[0.76rem] leading-5" : "text-[0.82rem] leading-6")}>
                {signal.description ?? "More signal context coming soon."}
              </p>
            </div>
            <span className={cx("font-label text-[0.56rem] font-medium uppercase tracking-[0.14em] text-on-surface-variant/70", compact ? "" : "justify-self-end")}>
              {formatSignalTime(signal.publishedAt)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
