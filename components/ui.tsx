"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/utils";

const AVATAR_FALLBACK_TIMEOUT_MS = 4000;

function sanitizeImageSrc(src: string | null | undefined) {
  const trimmed = src?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

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
  fallbackSrc?: string;
};

export function ImageCard({
  src,
  alt,
  className,
  priority,
  sizes = "100vw",
  imageClassName,
  fallbackSrc,
}: ImageCardProps) {
  const sanitizedSrc = sanitizeImageSrc(src);
  const sanitizedFallbackSrc = sanitizeImageSrc(fallbackSrc);
  const initialSrc = sanitizedSrc ?? sanitizedFallbackSrc;
  const [resolvedSrc, setResolvedSrc] = useState(initialSrc);
  const fallbackTimeoutRef = useRef<number | null>(null);

  function clearFallbackTimeout() {
    if (fallbackTimeoutRef.current !== null) {
      window.clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    setResolvedSrc(initialSrc);
  }, [initialSrc]);

  useEffect(() => {
    clearFallbackTimeout();

    if (!sanitizedFallbackSrc || !resolvedSrc || resolvedSrc === sanitizedFallbackSrc) {
      return;
    }

    fallbackTimeoutRef.current = window.setTimeout(() => {
      setResolvedSrc((current) => {
        if (!current || current === sanitizedFallbackSrc) {
          return current;
        }

        return sanitizedFallbackSrc;
      });
      fallbackTimeoutRef.current = null;
    }, AVATAR_FALLBACK_TIMEOUT_MS);

    return clearFallbackTimeout;
  }, [resolvedSrc, sanitizedFallbackSrc]);

  useEffect(() => clearFallbackTimeout, []);

  function handleImageLoad() {
    clearFallbackTimeout();
  }

  function handleImageError() {
    clearFallbackTimeout();

    if (sanitizedFallbackSrc && resolvedSrc !== sanitizedFallbackSrc) {
      setResolvedSrc(sanitizedFallbackSrc);
    }
  }

  return (
    <div className={cx("relative overflow-hidden", className)}>
      {resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={cx("object-cover", imageClassName)}
        />
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
        "kv-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary px-5 py-3 font-label text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-on-primary shadow-[0_12px_26px_rgba(0,0,0,0.28)] transition-[background-color,transform,opacity] duration-200 hover:-translate-y-0.5 hover:bg-primary/90",
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
        "kv-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-secondary/30 bg-secondary/14 px-5 py-3 font-label text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-secondary transition-[background-color,transform,opacity] duration-200 hover:-translate-y-0.5 hover:bg-secondary/20",
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
        "kv-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-container px-4 py-3 font-label text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-on-surface transition-colors duration-200 hover:bg-surface-container-high",
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
        "inline-flex items-center gap-2 rounded-full px-3 py-1 font-label text-[0.58rem] font-semibold uppercase tracking-[0.16em]",
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
        "rounded-[1.2rem] border border-primary/20 bg-primary/8 px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      {label ? (
          <div className="mb-1 font-label text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-primary">
          {label}
        </div>
      ) : null}
      <div className="flex items-end gap-1">
        <span className="font-display text-[2rem] font-bold leading-none tracking-[-0.06em] text-primary">{value}</span>
        {suffix ? <span className="pb-1 font-label text-xs font-semibold text-on-surface-variant">{suffix}</span> : null}
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
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest", className)}>
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
        compact ? "inline-flex rounded-xl border border-white/8 bg-surface-container-low p-1" : "flex items-end gap-6 border-b border-white/8",
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
              "kv-focus-ring relative font-label font-semibold uppercase transition-colors",
              compact
                ? cx(
                    "rounded-[0.7rem] px-4 py-2 text-[0.62rem] tracking-[0.14em]",
                    isActive
                      ? tone === "primary"
                        ? "bg-primary text-on-primary"
                        : "bg-secondary/20 text-secondary"
                      : "text-on-surface-variant hover:text-on-surface",
                  )
                : cx(
                    "pb-3 text-[0.72rem] tracking-[0.16em]",
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
        "kv-panel relative",
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
    <div className={cx("rounded-2xl border p-5", toneClasses, className)}>
      {icon ? (
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20">
          <Icon name={icon} className="text-[1.35rem]" filled={tone !== "neutral"} />
        </div>
      ) : null}
        <div className="font-label text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 font-display text-[2rem] font-bold tracking-[-0.06em] tabular-nums">{value}</div>
    </div>
  );
}

type PanelProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function Panel({ children, className, as: Component = "div" }: PanelProps) {
  return <Component className={cx("kv-panel", className)}>{children}</Component>;
}

export function CompactCard({ children, className, as: Component = "div" }: PanelProps) {
  return <Component className={cx("kv-card", className)}>{children}</Component>;
}

export function SectionHeader({
  eyebrow,
  title,
  copy,
  className,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow ? <div className="kv-label mb-2 text-secondary">{eyebrow}</div> : null}
        <h1 className="font-display text-[2rem] font-bold leading-none tracking-[-0.065em] text-white sm:text-[2.8rem]">
          {title}
        </h1>
        {copy ? <p className="mt-3 max-w-[42rem] text-base leading-7 text-on-surface-variant">{copy}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  meta,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  tone?: "primary" | "secondary" | "tertiary" | "neutral";
  className?: string;
}) {
  return (
    <CompactCard className={cx("p-4", className)}>
      <div className={cx("mb-3 h-1 w-8 rounded-full", tone === "primary" ? "bg-primary" : tone === "secondary" ? "bg-secondary" : tone === "tertiary" ? "bg-tertiary" : "bg-white/20")} />
      <div className="kv-label">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="kv-stat-number text-[2rem] leading-none">{value}</div>
        {meta ? <div className="pb-1 font-label text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{meta}</div> : null}
      </div>
    </CompactCard>
  );
}

export function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
  prefix,
  disabled,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  prefix?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="kv-label mb-2 block">
        {label}
      </label>
      <div className="relative rounded-xl border border-white/8 bg-surface-container-lowest transition-colors focus-within:border-secondary/45">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cx(
            "kv-focus-ring h-12 w-full bg-transparent px-4 text-base text-on-surface placeholder:text-on-surface-variant/55 disabled:cursor-not-allowed disabled:opacity-60",
            prefix ? "pl-10" : "",
          )}
        />
      </div>
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
