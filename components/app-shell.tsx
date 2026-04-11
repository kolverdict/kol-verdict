"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AvatarMenu } from "@/components/ui/avatar-menu";
import { navItems, type NavKey } from "@/lib/mock-data";
import { parseApiResponse } from "@/lib/api-client";
import type { KolSearchResponse } from "@/lib/types/api";
import { cx } from "@/lib/utils";
import { GhostButton, Icon, ImageCard } from "@/components/ui";

const LANDING_PAGE_URL = "https://kolverdict.fun/";

function normalizeSearchQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type MobileShellProps = {
  navKey: NavKey | null;
  avatar: string;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
};

export function MobileShell({
  navKey,
  avatar,
  title = "KOL VERDICT",
  eyebrow,
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
      <header className="glass-panel fixed inset-x-0 top-0 z-40 flex h-[4.75rem] items-center justify-between border-b border-white/8 px-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] md:hidden">
        <a
          href={LANDING_PAGE_URL}
          aria-label="Go to Kolverdict landing page"
          className="flex items-center gap-3"
        >
          <ImageCard
            src={avatar}
            alt="KOL Verdict profile avatar"
            className="h-9 w-9 rounded-xl border border-outline-variant/40 bg-surface-container-high"
            sizes="40px"
            priority
          />
          <div className="space-y-0.5">
            <div className="font-display text-[1.05rem] font-semibold tracking-[-0.04em] text-white">{title}</div>
            {eyebrow ? (
              <div className="font-label text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                {eyebrow}
              </div>
            ) : null}
          </div>
        </a>
        <AvatarMenu fallbackAvatar={avatar} mode="mobile" />
      </header>

      <main className={cx("px-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-[5.75rem]", className)}>{children}</main>

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
          "fixed inset-x-3 bottom-3 z-40 rounded-[1.55rem] border border-white/10 bg-[rgba(11,15,16,0.78)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_34px_rgba(0,0,0,0.42)] backdrop-blur-[18px] md:hidden",
          navVisible ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {navItems.map((item) => {
            const active = item.key === navKey;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cx(
                  "flex flex-col items-center justify-center rounded-[1.3rem] px-2 py-2.5 text-[0.56rem] font-display font-bold uppercase tracking-[0.18em] transition-colors",
                  active ? "bg-secondary/14 text-secondary" : "text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface",
                )}
              >
                <Icon name={item.icon} className="mb-1 text-[1.25rem]" filled={active} />
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
  navKey: NavKey | null;
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
  topbarIcons = ["notifications"],
  children,
  className,
  railButtonVariant = "primary",
}: DesktopShellProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isSearchingRef = useRef(false);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawQuery = searchInputRef.current?.value.trim() ?? "";
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    if (!rawQuery || !normalizedQuery || isSearchingRef.current) {
      return;
    }

    isSearchingRef.current = true;

    try {
      const response = await fetch(`/api/kols/search?query=${encodeURIComponent(rawQuery)}`, {
        method: "GET",
        cache: "no-store",
      });
      const result = await parseApiResponse<KolSearchResponse>(response);
      router.push(`/kol/${result.match?.slug ?? normalizedQuery}`);
    } catch {
      router.push(`/kol/${normalizedQuery}`);
    } finally {
      isSearchingRef.current = false;
    }
  }

  return (
    <div className="hidden min-h-screen bg-background text-on-surface md:block">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[14rem] flex-col border-r border-white/8 bg-[rgba(7,9,9,0.96)] px-4 py-5">
        <a href={LANDING_PAGE_URL} aria-label="Go to Kolverdict landing page" className="block">
          <div className="space-y-1">
            <div className="font-display text-[1.25rem] font-bold uppercase tracking-[-0.055em] text-white">KOL Verdict</div>
            <div className="font-label text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Verdict Engine
            </div>
          </div>
        </a>

        <nav className="mt-7 space-y-1.5">
          {navItems.map((item) => {
            const active = item.key === navKey;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cx(
                  "kv-focus-ring flex items-center gap-3 rounded-[0.95rem] px-3.5 py-3 font-label text-[0.66rem] font-semibold uppercase tracking-[0.16em] transition-colors duration-200",
                  active ? "bg-white/[0.07] text-white" : "text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface",
                )}
              >
                <Icon
                  name={item.desktopIcon ?? item.icon}
                  className={cx("text-[1.15rem]", active ? "text-secondary" : "text-current")}
                  filled={active}
                />
                {item.label === "Profile" ? "Profile" : item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          {railButtonVariant === "primary" ? (
            <Link
              href="/profile"
              className="kv-focus-ring flex h-12 items-center justify-center rounded-[0.95rem] border border-primary/25 bg-primary/90 font-label text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-on-primary shadow-[0_12px_26px_rgba(0,0,0,0.28)] transition-colors hover:bg-primary"
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

      <div className="min-h-screen pl-[14rem]">
        <header
          className={cx(
            "glass-panel fixed left-[14rem] right-0 top-0 z-30 flex h-16 items-center border-b border-white/8 px-6",
            searchPlaceholder ? "justify-between" : "justify-end",
          )}
        >
          <div className="flex items-center gap-6">
            {searchPlaceholder ? (
              <form
                role="search"
                onSubmit={handleSearchSubmit}
                className="flex h-12 min-w-[18rem] items-center gap-3 rounded-full bg-surface-container-lowest px-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                <button
                  type="submit"
                  aria-label="Search KOL profiles"
                  className="flex items-center justify-center text-on-surface-variant"
                >
                  <Icon name="search" className="text-[1.2rem]" />
                </button>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant"
                />
              </form>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-on-surface-variant">
              {topbarIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className="kv-focus-ring flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/[0.05] hover:text-on-surface"
                >
                  <Icon name={icon} className="text-[1.25rem]" />
                </button>
              ))}
            </div>
            <AvatarMenu fallbackAvatar={avatar} mode="desktop" />
          </div>
        </header>

        <main className={cx("min-h-screen px-0 pb-10 pt-16", className)}>{children}</main>
      </div>
    </div>
  );
}
