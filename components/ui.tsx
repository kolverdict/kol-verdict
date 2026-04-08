"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cx } from "@/lib/utils";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: number;
};

export function Icon({ name, className, filled = false, weight = 450 }: IconProps) {
  return (
    <span
      className={cx("material-symbols-rounded select-none align-middle", className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

type ImageCardProps = {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  imageClassName?: string;
};

export function ImageCard({
  src,
  alt,
  className,
  priority,
  sizes = "100vw",
  imageClassName,
}: ImageCardProps) {
  return (
    <div className={cx("relative overflow-hidden", className)}>
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={cx("object-cover", imageClassName)} />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(0,207,252,0.16),transparent_34%),radial-gradient(circle_at_74%_78%,rgba(156,255,147,0.14),transparent_38%),linear-gradient(180deg,rgba(18,22,26,0.98),rgba(8,10,12,1))]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_54%,rgba(0,0,0,0.48)_100%)]" />
        </>
      )}
    </div>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  icon?: string;
  iconFilled?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function PrimaryButton({ children, className, href, icon, iconFilled, onClick, disabled, type = "button" }: ButtonProps) {
  const content = (
    <span
      className={cx(
        "liquid-neon-primary primary-glow inline-flex items-center justify-center gap-2 rounded-[1.15rem] px-5 py-3 font-display text-[0.7rem] font-bold uppercase tracking-[0.24em] transition-transform duration-300 hover:-translate-y-0.5",
        disabled ? "cursor-not-allowed opacity-70 hover:translate-y-0" : "",
        className,
      )}
    >
      {children}
      {icon ? <Icon name={icon} filled={iconFilled} className="text-[1rem]" /> : null}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex">
      {content}
    </button>
  );
}

export function CyanButton({ children, className, href, icon, iconFilled, onClick, disabled, type = "button" }: ButtonProps) {
  const content = (
    <span
      className={cx(
        "liquid-neon-cyan cyan-glow inline-flex items-center justify-center gap-2 rounded-[1.2rem] px-5 py-3 font-display text-[0.72rem] font-bold uppercase tracking-[0.22em] transition-transform duration-300 hover:-translate-y-0.5",
        disabled ? "cursor-not-allowed opacity-70 hover:translate-y-0" : "",
        className,
      )}
    >
      {children}
      {icon ? <Icon name={icon} filled={iconFilled} className="text-[1rem]" /> : null}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex">
      {content}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  href,
  icon,
  iconFilled,
  onClick,
  disabled,
  type = "button",
}: ButtonProps) {
  const content = (
    <span
      className={cx(
        "ghost-outline glass-panel inline-flex items-center justify-center gap-2 rounded-[1.05rem] px-4 py-3 font-display text-[0.68rem] font-bold uppercase tracking-[0.22em] text-on-surface transition-colors duration-300 hover:bg-white/8",
        disabled ? "cursor-not-allowed opacity-70 hover:bg-transparent" : "",
        className,
      )}
    >
      {children}
      {icon ? <Icon name={icon} filled={iconFilled} className="text-[1rem]" /> : null}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex">
      {content}
    </button>
  );
}

type PillProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "primary" | "secondary" | "neutral";
};

export function Pill({ children, className, tone = "neutral" }: PillProps) {
  const toneClasses =
    tone === "primary"
      ? "border border-primary/25 bg-primary/10 text-primary"
      : tone === "secondary"
        ? "border border-secondary/25 bg-secondary/10 text-secondary"
        : "border border-white/10 bg-surface-container-highest/70 text-on-surface-variant";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 font-display text-[0.58rem] font-bold uppercase tracking-[0.24em]",
        toneClasses,
        className,
      )}
    >
      {children}
    </span>
  );
}

type ScoreChipProps = {
  value: number | string;
  suffix?: string;
  label?: string;
  className?: string;
};

export function ScoreChip({ value, suffix, label, className }: ScoreChipProps) {
  return (
    <div
      className={cx(
        "glass-panel border border-primary/25 rounded-[1.55rem] px-4 py-3 shadow-[0_0_24px_rgba(156,255,147,0.12)]",
        className,
      )}
    >
      {label ? (
        <div className="mb-1 font-display text-[0.53rem] font-bold uppercase tracking-[0.26em] text-primary">
          {label}
        </div>
      ) : null}
      <div className="flex items-end gap-1">
        <span className="font-display text-[2rem] font-black leading-none text-primary">{value}</span>
        {suffix ? <span className="pb-1 font-display text-xs font-bold text-on-surface-variant">{suffix}</span> : null}
      </div>
    </div>
  );
}

type TrustMeterProps = {
  value: number;
  className?: string;
};

export function TrustMeter({ value, className }: TrustMeterProps) {
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-container-highest", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        className="h-full rounded-full bg-gradient-to-r from-primary via-primary-dim to-secondary"
      />
    </div>
  );
}

type TabStripProps = {
  tabs: string[];
  active: string;
  onChange?: (tab: string) => void;
  className?: string;
  compact?: boolean;
  tone?: "primary" | "secondary";
};

export function TabStrip({
  tabs,
  active,
  onChange,
  className,
  compact = false,
  tone = "primary",
}: TabStripProps) {
  return (
    <div
      className={cx(
        compact ? "inline-flex rounded-[1rem] bg-surface-container-low p-1" : "flex items-end gap-7 border-b border-white/6",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange?.(tab)}
            className={cx(
              "relative font-display font-bold uppercase transition-colors",
              compact
                ? cx(
                    "rounded-[0.85rem] px-5 py-2 text-[0.65rem] tracking-[0.18em]",
                    isActive
                      ? tone === "primary"
                        ? "bg-primary text-on-primary shadow-[0_0_18px_rgba(156,255,147,0.2)]"
                        : "bg-secondary text-on-secondary shadow-[0_0_18px_rgba(0,207,252,0.2)]"
                      : "text-on-surface-variant hover:text-on-surface",
                  )
                : cx(
                    "pb-4 text-sm tracking-[0.2em]",
                    isActive ? (tone === "primary" ? "text-primary" : "text-secondary") : "text-on-surface-variant hover:text-on-surface",
                  ),
            )}
          >
            {tab}
            {!compact && isActive ? (
              <motion.span
                layoutId={`tab-strip-${tone}`}
                className={cx(
                  "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                  tone === "primary" ? "bg-primary" : "bg-secondary",
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type SurfaceCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div
      className={cx(
        "relative rounded-[2rem] bg-surface-container-low/90 shadow-[0_24px_48px_rgba(0,0,0,0.42)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  icon?: string;
  tone?: "primary" | "secondary" | "tertiary" | "neutral";
  className?: string;
};

export function MetricCard({ label, value, icon, tone = "neutral", className }: MetricCardProps) {
  const toneClasses =
    tone === "primary"
      ? "text-primary border-primary/15 bg-primary/5"
      : tone === "secondary"
        ? "text-secondary border-secondary/15 bg-secondary/5"
        : tone === "tertiary"
          ? "text-tertiary border-tertiary/15 bg-tertiary/5"
          : "text-on-surface border-white/6 bg-surface-container-high";

  return (
    <div className={cx("rounded-[1.65rem] border p-5", toneClasses, className)}>
      {icon ? (
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20">
          <Icon name={icon} className="text-[1.35rem]" filled={tone !== "neutral"} />
        </div>
      ) : null}
      <div className="font-display text-[0.58rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 font-display text-[2rem] font-black tracking-tight">{value}</div>
    </div>
  );
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
