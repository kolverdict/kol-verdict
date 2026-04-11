import { Icon } from "@/components/ui";
import { cx } from "@/lib/utils";

export type KolMetricItem = {
  label: string;
  value: string;
  icon: string;
};

export function KolMetricsGrid({
  items,
  compact = false,
}: {
  items: KolMetricItem[];
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cx(
            "rounded-[1.15rem] border border-white/8 bg-black/16",
            compact ? "px-3 py-3" : "px-4 py-4",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/72">
                {item.label}
              </p>
              <p
                className={cx(
                  "mt-2 font-display font-black leading-none tracking-[-0.06em] text-white",
                  compact ? "text-[1.35rem]" : "text-[1.8rem]",
                )}
              >
                {item.value}
              </p>
            </div>
            <span
              className={cx(
                "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-secondary",
                compact ? "h-8 w-8" : "h-9 w-9",
              )}
            >
              <Icon name={item.icon} className={compact ? "text-[1rem]" : "text-[1.05rem]"} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
