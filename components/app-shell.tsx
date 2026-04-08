"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { navItems, type NavKey } from "@/lib/mock-data";
import { cx } from "@/lib/utils";
import { GhostButton, Icon, ImageCard } from "@/components/ui";

type MobileShellProps = {
  navKey: NavKey;
  avatar: string;
  title?: string;
  eyebrow?: string;
  rightIcon?: string;
  rightIconTone?: "secondary" | "muted";
  children: React.ReactNode;
  className?: string;
};

export function MobileShell({
  navKey,
  avatar,
  title = "KOL VERDICT",
  eyebrow,
  rightIcon = "settings",
  rightIconTone = "muted",
  children,
  className,
}: MobileShellProps) {
  const pathname = usePathname();
  const [navVisible, setNavVisible] = useState(true);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateVisibility() {
      if (previousPathnameRef.current !== pathname) {
        previousPathnameRef.current = pathname;
        lastScrollY = window.scrollY;
        setNavVisible(true);
        ticking = false;
        return;
      }

      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollY;
      const nearTop = nextScrollY < 72;

      if (nearTop) {
        setNavVisible(true);
      } else if (Math.abs(delta) >= 8) {
        setNavVisible(delta < 0);
        lastScrollY = nextScrollY;
      }

      if (nearTop) {
        lastScrollY = nextScrollY;
      }

      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background md:hidden">
      <header className="glass-panel fixed inset-x-0 top-0 z-40 flex h-[5.5rem] items-center justify-between border-b border-white/5 px-5 shadow-[0_24px_48px_rgba(0,0,0,0.35)] md:hidden">
        <div className="flex items-center gap-3">
          <ImageCard
            src={avatar}
            alt="KOL Verdict profile avatar"
            className="h-10 w-10 rounded-2xl border border-outline-variant/30 bg-surface-container-high"
            sizes="40px"
            priority
          />
          <div className="space-y-0.5">
            <div className="font-display text-xl font-bold tracking-[-0.05em] text-white">{title}</div>
            {eyebrow ? (
              <div className="font-display text-[0.5rem] font-bold uppercase tracking-[0.28em] text-primary/70">
                {eyebrow}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={cx(
            "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
            rightIconTone === "secondary"
              ? "text-secondary"
              : "text-zinc-500 hover:text-secondary",
          )}
        >
          <Icon name={rightIcon} className="text-[1.35rem]" filled={rightIconTone === "secondary"} />
        </button>
      </header>

      <main className={cx("px-5 pb-[8.2rem] pt-24", className)}>{children}</main>

      <motion.nav
        initial={false}
        animate={{
          y: navVisible ? 0 : 108,
          opacity: navVisible ? 1 : 0,
        }}
        transition={{
          duration: 0.24,
          ease: [0.2, 0, 0, 1],
        }}
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 rounded-t-[2rem] border-t border-white/6 bg-[rgba(11,13,16,0.64)] px-3 pb-5 pt-2.5 shadow-[0_-12px_32px_rgba(0,0,0,0.4)] backdrop-blur-[20px] md:hidden",
          navVisible ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div className="grid grid-cols-4 gap-2">
          {navItems.map((item) => {
            const active = item.key === navKey;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cx(
                  "flex flex-col items-center justify-center rounded-[1.3rem] px-2 py-2.5 text-[0.56rem] font-display font-bold uppercase tracking-[0.18em] transition-colors",
                  active ? "bg-secondary/12 text-secondary" : "text-zinc-500 hover:bg-white/4 hover:text-on-surface",
                )}
              >
                <Icon name={item.icon} className="mb-0.5 text-[1.35rem]" filled={active} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </motion.nav>
    </div>
  );
}

type DesktopShellProps = {
  navKey: NavKey;
  avatar: string;
  searchPlaceholder?: string;
  topbarIcons?: string[];
  children: React.ReactNode;
  className?: string;
  railButtonVariant?: "primary" | "ghost";
};

export function DesktopShell({
  navKey,
  avatar,
  searchPlaceholder,
  topbarIcons = ["notifications", "settings"],
  children,
  className,
  railButtonVariant = "primary",
}: DesktopShellProps) {
  return (
    <div className="hidden min-h-screen bg-background text-on-surface md:block">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[15rem] flex-col border-r border-white/5 bg-[#0c0c0c] px-5 py-6">
        <div className="space-y-1">
          <div className="font-display text-[1.8rem] font-black uppercase tracking-[-0.06em] text-white">KOL Verdict</div>
          <div className="font-display text-[0.56rem] font-bold uppercase tracking-[0.28em] text-on-surface-variant">
            The Obsidian Oracle
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const active = item.key === navKey;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cx(
                  "flex items-center gap-3 rounded-[1rem] px-4 py-3 font-display text-[0.68rem] font-bold uppercase tracking-[0.22em] transition-transform duration-300",
                  active ? "scale-[1.05] bg-white/10 text-white" : "text-zinc-500 hover:bg-white/4 hover:text-on-surface",
                )}
              >
                <Icon
                  name={item.desktopIcon ?? item.icon}
                  className={cx("text-[1.15rem]", active ? "text-secondary" : "text-current")}
                  filled={active}
                />
                {item.label === "Profile" ? "My Profile" : item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          {railButtonVariant === "primary" ? (
            <Link
              href="/profile"
              className="liquid-neon-primary primary-glow flex h-14 items-center justify-center rounded-[1rem] font-display text-[0.7rem] font-bold uppercase tracking-[0.28em]"
            >
              Mint Reputation
            </Link>
          ) : (
            <GhostButton href="/profile" className="w-full justify-center rounded-[1rem] py-4">
              Mint Reputation
            </GhostButton>
          )}
        </div>
      </aside>

      <div className="min-h-screen pl-[15rem]">
        <header
          className={cx(
            "glass-panel fixed left-[15rem] right-0 top-0 z-30 flex h-20 items-center border-b border-white/5 px-8",
            searchPlaceholder ? "justify-between" : "justify-end",
          )}
        >
          <div className="flex items-center gap-6">
            {searchPlaceholder ? (
              <label className="flex h-12 min-w-[18rem] items-center gap-3 rounded-full bg-surface-container-lowest px-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <Icon name="search" className="text-[1.2rem] text-on-surface-variant" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant"
                />
              </label>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-on-surface-variant">
              {topbarIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl hover:bg-white/5 hover:text-on-surface"
                >
                  <Icon name={icon} className="text-[1.25rem]" />
                </button>
              ))}
            </div>
            <ImageCard
              src={avatar}
              alt="KOL Verdict account avatar"
              className="h-10 w-10 rounded-2xl border border-primary/20 bg-surface-container-high"
              sizes="40px"
            />
          </div>
        </header>

        <main className={cx("min-h-screen px-8 pb-12 pt-24", className)}>{children}</main>
      </div>
    </div>
  );
}
