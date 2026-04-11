import type { KolProfileDetail } from "@/lib/types/api";
import type { HomeCardView } from "@/lib/types/domain";
import { Icon } from "@/components/ui";
import { cx } from "@/lib/utils";

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

export function KolVerdictPanel({
  verdictTitle,
  verdictSummary,
  reasoningPoints,
  trustScore,
  reasonTags,
  compact = false,
}: {
  verdictTitle: string | null;
  verdictSummary: string | null;
  reasoningPoints: KolProfileDetail["reasoningPoints"];
  trustScore: number | null;
  reasonTags: HomeCardView["reasonTags"];
  compact?: boolean;
}) {
  const trustToneClasses =
    trustScore === null
      ? "bg-white/10 text-white"
      : trustScore >= 70
      ? "bg-primary text-on-primary"
      : trustScore >= 55
        ? "bg-secondary/90 text-on-secondary"
        : "bg-tertiary/90 text-on-tertiary";

  return (
    <section className={cx("rounded-[1.35rem] border border-white/8 bg-surface-container-low/78", compact ? "px-4 py-4" : "px-5 py-5")}>
      <div
        className={cx(
          "flex items-center justify-between gap-4 rounded-[1.1rem] px-4 py-4",
          trustToneClasses,
        )}
      >
        <div>
          <p className="font-label text-[0.5rem] font-semibold uppercase tracking-[0.18em] opacity-75">
            Verdict
          </p>
          <h3
            className={cx(
              "mt-2 font-display font-black uppercase leading-[0.92] tracking-[-0.06em]",
              compact ? "text-[1.4rem]" : "text-[1.85rem]",
            )}
          >
            {verdictTitle ?? "Intelligence pending"}
          </h3>
        </div>
        <Icon
          name={trustScore === null ? "hourglass_top" : trustScore >= 70 ? "verified" : trustScore >= 55 ? "radar" : "warning"}
          filled={trustScore !== null && trustScore >= 70}
          className={compact ? "text-[1.65rem]" : "text-[2rem]"}
        />
      </div>

      <p className={cx("mt-4 text-on-surface-variant", compact ? "text-[0.82rem] leading-6" : "text-[0.92rem] leading-7")}>
        {verdictSummary ?? "More profile intelligence coming soon."}
      </p>

      {reasonTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {reasonTags.slice(0, compact ? 2 : 3).map((tag) => (
            <span
              key={tag.label}
              className={cx(
                "inline-flex items-center rounded-full border px-3 py-1.5 font-label text-[0.54rem] font-semibold uppercase tracking-[0.12em]",
                reasonTagToneClasses(tag.tone),
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <p className="font-label text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/72">
          Key Reasoning
        </p>
        {reasoningPoints.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {reasoningPoints.map((point) => (
              <li key={point.id} className="flex items-start gap-3">
                <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-primary" />
                <span className={cx("text-white/88", compact ? "text-[0.8rem] leading-6" : "text-[0.86rem] leading-6")}>
                  {point.content}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cx("mt-3 text-on-surface-variant", compact ? "text-[0.8rem] leading-6" : "text-[0.86rem] leading-6")}>
            More profile intelligence coming soon.
          </p>
        )}
      </div>
    </section>
  );
}
