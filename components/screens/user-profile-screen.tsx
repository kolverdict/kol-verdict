"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/app-shell";
import { WalletConnectPrompt } from "@/components/wallet-gate";
import { useWalletSession } from "@/components/wallet-session-provider";
import { Icon, ImageCard } from "@/components/ui";
import { brandAvatar, navItems } from "@/lib/mock-data";
import type { ActivityView, Tone, UserProfileView } from "@/lib/types/domain";
import { cx } from "@/lib/utils";

type UserProfileScreenProps = {
  userProfile: UserProfileView | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortWallet(address: string | null | undefined) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function toneClasses(tone: Tone) {
  if (tone === "primary") {
    return "bg-primary/10 text-primary";
  }

  if (tone === "secondary") {
    return "bg-secondary/10 text-secondary";
  }

  if (tone === "tertiary") {
    return "bg-tertiary/10 text-tertiary";
  }

  return "bg-on-surface-variant/10 text-on-surface-variant";
}

function EmptyMessage({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-white/5 bg-surface-container-low/60 px-5 py-4 font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant",
        className,
      )}
    >
      {message}
    </div>
  );
}

function MobileActivityRow({ item }: { item: ActivityView }) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-transparent bg-surface-container-low/50 p-4 transition-all duration-300 hover:border-outline-variant/20 hover:bg-surface-container">
      <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneClasses(item.tone))}>
        <Icon name={item.icon} className="text-[1.15rem]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-on-surface">{item.title}</p>
        <p className="mt-1 line-clamp-2 text-[0.7rem] text-on-surface-variant">{item.detail}</p>
        <p className="mt-1 text-[0.7rem] text-on-surface-variant">{item.time}</p>
      </div>
      <Icon name="chevron_right" className="text-[1.2rem] text-on-surface-variant transition-colors group-hover:text-white" />
    </div>
  );
}

function DesktopArtifactRow({ item }: { item: UserProfileView["recentArtifacts"][number] }) {
  return (
    <div className="group flex items-center gap-6 rounded-xl border border-white/5 bg-surface-container-high p-6 transition-all duration-300 hover:bg-surface-container-highest">
      <div className={cx("rounded-lg p-3", toneClasses(item.tone))}>
        <Icon name={item.icon} filled={item.tone !== "secondary"} className="text-[1.2rem]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-4">
          <span className="truncate text-sm font-bold text-white">{item.title}</span>
          <span className="shrink-0 font-display text-[0.58rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {item.time}
          </span>
        </div>
        <p className="truncate text-xs text-on-surface-variant">{item.body}</p>
      </div>
    </div>
  );
}

function DesktopSidebarNav() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/5 bg-[#0e0e0e] px-6 pt-28 md:flex md:flex-col">
      <div className="font-display text-xl font-black text-white">KOL Verdict</div>
      <div className="mb-8 mt-2 font-display text-[0.56rem] font-bold uppercase tracking-[0.28em] text-on-surface-variant">
        The Obsidian Oracle
      </div>

      <div className="flex flex-col gap-2">
        {navItems.map((item) => {
          const active = item.key === "profile";

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-300",
                item.key === "profile" ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                name={item.desktopIcon ?? item.icon}
                className={cx("text-[1.15rem] transition-transform group-hover:scale-105", active ? "text-secondary" : "text-current")}
                filled={active}
              />
              <span className="font-display text-[0.72rem] font-bold uppercase tracking-[0.22em]">
                {item.key === "profile" ? "My Profile" : item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto pb-6">
        <button
          type="button"
          className="w-full rounded-xl border border-primary/20 bg-surface-container-highest py-4 font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-primary transition-all duration-300 hover:bg-primary/10"
        >
          Mint Reputation
        </button>
      </div>
    </aside>
  );
}

function DesktopTopNav({ avatar }: { avatar: string }) {
  return (
    <nav className="fixed left-64 right-0 top-0 z-50 hidden h-20 items-center justify-end bg-[#0e0e0e]/70 px-8 shadow-[0_24px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl md:flex">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 text-on-surface-variant">
          <button type="button" className="transition-colors hover:text-white">
            <Icon name="notifications" className="text-[1.25rem]" />
          </button>
          <button type="button" className="transition-colors hover:text-white">
            <Icon name="settings" className="text-[1.25rem]" />
          </button>
        </div>
        <ImageCard
          src={avatar}
          alt="KOL Verdict account avatar"
          className="h-10 w-10 rounded-2xl border border-primary/20 bg-surface-container-high"
          sizes="40px"
          priority
        />
      </div>

      <div className="absolute bottom-0 left-0 h-px w-full bg-[#1a1a1a]" />
    </nav>
  );
}

export function UserProfileScreen({ userProfile }: UserProfileScreenProps) {
  const { session, connect, status, error } = useWalletSession();
  const avatar = userProfile?.heroAvatar ?? session?.avatarUrl ?? brandAvatar;
  const eyebrow = shortWallet(userProfile?.profile.walletAddress);
  const progressWidth = clamp(userProfile?.profile.influenceWeight ?? 14, 14, 100);
  const walletBusy = status === "connecting" || status === "disconnecting";

  return (
    <>
      <MobileShell navKey="profile" avatar={avatar} eyebrow={eyebrow || undefined} rightIcon="settings">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
          className="relative space-y-11"
        >
          <div className="pointer-events-none absolute left-1/2 top-6 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]" />

          {userProfile ? (
            <>
              <section className="flex flex-col items-center pt-3 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary-container/30 px-4 py-1.5">
                  <Icon name="verified" filled className="text-[0.9rem] text-secondary" />
                  <span className="font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-secondary">
                    {userProfile.heroTag}
                  </span>
                </div>

                <h2 className="mb-2 font-display text-[0.76rem] font-medium uppercase tracking-[0.26em] text-on-surface-variant">
                  Your Verdict Score
                </h2>
                <div className="flex items-end justify-center gap-2">
                  <span className="font-display text-[4.6rem] font-black tracking-[-0.09em] text-transparent bg-[linear-gradient(135deg,#9cff93_0%,#00ec3b_100%)] bg-clip-text drop-shadow-[0_0_15px_rgba(156,255,147,0.3)]">
                    {formatInteger(userProfile.reputationPoints)}
                  </span>
                  <span className="pb-3 font-display text-[2rem] font-bold text-primary/50">pts</span>
                </div>

                <div className="mt-8 w-full max-w-md rounded-xl bg-surface-container-low p-1">
                  <div className="h-2 overflow-hidden rounded-lg bg-surface-container-highest">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-primary via-primary-dim to-secondary shadow-[0_0_20px_rgba(156,255,147,0.4)]"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between px-2">
                    <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {userProfile.rankLabel}
                    </span>
                    <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.18em] text-primary">
                      {userProfile.reputationDelta}
                    </span>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-4">
                {userProfile.mobileStats.map((stat) => (
                  <div
                    key={stat.label}
                    className={cx(
                      "rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-colors duration-300 hover:bg-surface-container",
                      stat.span,
                    )}
                  >
                    <Icon
                      name={stat.icon}
                      className={cx(
                        "mb-4 text-[1.35rem]",
                        stat.tone === "primary" ? "text-primary" : stat.tone === "secondary" ? "text-secondary" : stat.tone === "tertiary" ? "text-tertiary" : "text-on-surface-variant",
                      )}
                    />
                    <p className="mb-1 font-display text-[0.5rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
                      {stat.label}
                    </p>
                    <div className="flex items-end gap-2">
                      <p className="font-display text-[2.25rem] font-bold tracking-[-0.06em] text-on-surface">{stat.value}</p>
                      {stat.delta ? (
                        <span className="mb-1.5 font-display text-xs font-bold text-primary">{stat.delta}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[1.45rem] font-bold tracking-[-0.04em] text-white">Recent Activity</h3>
                  <button
                    type="button"
                    className="font-display text-[0.54rem] font-bold uppercase tracking-[0.22em] text-secondary hover:underline"
                  >
                    View Ledger
                  </button>
                </div>

                <div className="space-y-3">
                  {userProfile.recentActivity.length > 0 ? (
                    userProfile.recentActivity.map((item) => <MobileActivityRow key={item.id} item={item} />)
                  ) : (
                    <EmptyMessage message="No activity recorded yet." />
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="pt-4">
              <WalletConnectPrompt
                title="Connect Wallet"
                message="Connect your wallet to load your live reputation ledger, recent activity, and trust clusters."
                busy={walletBusy}
                error={error}
                eyebrow={
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-low px-4 py-1.5">
                    <Icon name="account_balance_wallet" className="text-[0.9rem] text-secondary" />
                    <span className="font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-secondary">
                      Account View
                    </span>
                  </div>
                }
                footer={<EmptyMessage message="Connect your wallet to load your account-specific profile." className="py-6 text-center" />}
                cardClassName="space-y-0 rounded-[1.5rem] border border-white/5 bg-surface-container-low px-6 py-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
                onConnect={connect}
              />
            </div>
          )}
        </motion.section>
      </MobileShell>

      <div className="hidden bg-surface text-on-surface md:block">
        <DesktopTopNav avatar={avatar} />
        <DesktopSidebarNav />

        <main className="min-h-screen pt-20 md:pl-64">
          <div className="mx-auto max-w-7xl space-y-12 p-8 md:p-12">
            {userProfile ? (
              <>
                <motion.header
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
                  className="relative flex flex-col gap-8 md:flex-row md:items-end"
                >
                  <div className="relative">
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-high shadow-2xl md:h-40 md:w-40">
                      <ImageCard
                        src={userProfile.portraitImage}
                        alt={`${userProfile.displayName} portrait`}
                        className="h-full w-full"
                        sizes="160px"
                        priority
                        imageClassName="object-cover grayscale transition-all duration-500 hover:grayscale-0"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 rounded-full border-4 border-surface bg-primary p-2 text-on-primary">
                      <Icon name="verified" filled className="text-[1.15rem]" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <h1 className="font-display text-[4rem] font-black tracking-[-0.08em] text-white md:text-[5rem]">
                        {userProfile.displayName}
                      </h1>
                      <span className="rounded-full border border-secondary/20 bg-secondary-container/30 px-3 py-1 font-display text-[0.56rem] font-bold uppercase tracking-[0.24em] text-secondary">
                        {userProfile.heroHandle}
                      </span>
                    </div>
                    <p className="max-w-xl font-light leading-relaxed text-on-surface-variant">{userProfile.heroBio}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="rounded-xl border border-white/5 bg-surface-container-high p-3 transition-colors duration-300 hover:bg-surface-container-highest"
                    >
                      <Icon name="share" className="text-[1.2rem]" />
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-white/5 bg-surface-container-high px-6 py-3 font-display text-[0.72rem] font-bold uppercase tracking-[0.22em] text-white transition-colors duration-300 hover:bg-surface-container-highest"
                    >
                      Edit Profile
                    </button>
                  </div>
                </motion.header>

                <motion.section
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.06, ease: [0.2, 0, 0, 1] }}
                  className="grid grid-cols-1 gap-6 md:grid-cols-3"
                >
                  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-surface-container-low p-8 shadow-[0_24px_48px_rgba(0,0,0,0.4)] md:col-span-2">
                    <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary/5 blur-[100px]" />
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <div>
                        <div className="mb-6 flex items-start justify-between">
                          <span className="font-display text-[0.5rem] font-bold uppercase tracking-[0.3em] text-on-surface-variant">
                            Verdict Score
                          </span>
                          <span className="font-display text-[0.5rem] font-bold uppercase tracking-[0.22em] text-primary">
                            {userProfile.reputationDelta}
                          </span>
                        </div>
                        <div className="font-display text-[7rem] font-black tracking-[-0.1em] text-transparent bg-[linear-gradient(135deg,#9cff93_0%,#00ec3b_100%)] bg-clip-text drop-shadow-[0_0_30px_rgba(156,255,147,0.3)] md:text-[8.5rem]">
                          {formatInteger(userProfile.reputationPoints)}
                        </div>
                      </div>

                      <div className="mt-10 flex items-center gap-6">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                          <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${progressWidth}%` }} />
                        </div>
                        <span className="font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-white">
                          {userProfile.rankLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-white/5 bg-surface-container-low p-8 shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
                    <div>
                      <span className="mb-4 block font-display text-[0.5rem] font-bold uppercase tracking-[0.3em] text-on-surface-variant">
                        Influence Weight
                      </span>
                      <div className="font-display text-[4rem] font-black tracking-[-0.08em] text-secondary">
                        {userProfile.influenceWeightLabel.replace("NW", "")}
                        <span className="text-[1.55rem]">NW</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {userProfile.mobileStats.map((item, index) => (
                        <div
                          key={item.label}
                          className={cx(
                            "flex justify-between pb-2 font-display text-[0.58rem] font-bold uppercase tracking-[0.18em]",
                            index < userProfile.mobileStats.length - 1 ? "border-b border-white/5" : "",
                          )}
                        >
                          <span className="text-on-surface-variant">{item.label}</span>
                          <span className="text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.section>

                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.12, ease: [0.2, 0, 0, 1] }}
                  className="grid grid-cols-1 gap-12 lg:grid-cols-3"
                >
                  <section className="space-y-8 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-[1.45rem] font-bold uppercase tracking-[0.16em] text-white">
                        Recent Artifacts
                      </h2>
                      <button
                        type="button"
                        className="font-display text-[0.56rem] font-bold uppercase tracking-[0.22em] text-primary hover:underline"
                      >
                        View Ledger
                      </button>
                    </div>

                    <div className="space-y-4">
                      {userProfile.recentArtifacts.length > 0 ? (
                        userProfile.recentArtifacts.map((item) => (
                          <DesktopArtifactRow key={`${item.title}-${item.time}`} item={item} />
                        ))
                      ) : (
                        <EmptyMessage message="No profile artifacts recorded yet." className="py-6" />
                      )}
                    </div>
                  </section>

                  <aside className="space-y-8">
                    <h2 className="font-display text-[1.45rem] font-bold uppercase tracking-[0.16em] text-white">Trust Clusters</h2>

                    <div className="rounded-xl border border-white/5 bg-surface-container-low p-6">
                      <div className="relative mb-6 aspect-square w-full overflow-hidden rounded-lg border border-white/5 bg-surface-container-lowest">
                        <div className="absolute inset-0 opacity-20">
                          <ImageCard
                            src={userProfile.clusterImage}
                            alt={`${userProfile.displayName} interaction map`}
                            className="h-full w-full"
                            sizes="320px"
                            imageClassName="object-cover blur-sm"
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon name="hub" className="text-[4rem] text-primary/40" />
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 rounded bg-surface-container/80 p-3 text-center font-display text-[0.5rem] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md">
                          Real-time Interaction Map
                        </div>
                      </div>

                      <div className="space-y-4">
                        {userProfile.trustClusters.length > 0 ? (
                          userProfile.trustClusters.map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cx(
                                    "h-2 w-2 rounded-full",
                                    item.tone === "primary"
                                      ? "bg-primary shadow-[0_0_8px_rgba(156,255,147,1)]"
                                      : item.tone === "secondary"
                                        ? "bg-secondary shadow-[0_0_8px_rgba(0,207,252,1)]"
                                        : item.tone === "tertiary"
                                          ? "bg-tertiary shadow-[0_0_8px_rgba(255,113,102,1)]"
                                          : "bg-on-surface-variant",
                                  )}
                                />
                                <span className="font-display text-[0.58rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                                  {item.label}
                                </span>
                              </div>
                              <span className="text-[0.72rem] text-white">{item.value}</span>
                            </div>
                          ))
                        ) : (
                          <EmptyMessage message="No trust clusters recorded yet." className="py-5" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-display text-[0.82rem] font-bold uppercase tracking-[0.22em] text-white">
                        Metadata Achievements
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {userProfile.achievements.length > 0 ? (
                          userProfile.achievements.map((item) => (
                            <div
                              key={item.label}
                              className={cx(
                                "flex items-center gap-2 rounded-full border px-3 py-1.5 font-display text-[0.5rem] font-bold uppercase tracking-[0.16em]",
                                item.tone === "primary"
                                  ? "border-primary/30 bg-primary-container/20 text-primary"
                                  : item.tone === "secondary"
                                    ? "border-secondary/30 bg-secondary-container/20 text-secondary"
                                    : item.tone === "tertiary"
                                      ? "border-tertiary/30 bg-tertiary/15 text-tertiary"
                                      : "border-white/5 bg-surface-container-highest text-on-surface-variant",
                              )}
                            >
                              <Icon name={item.icon} className="text-[0.85rem]" />
                              {item.label}
                            </div>
                          ))
                        ) : (
                          <EmptyMessage message="No achievements unlocked yet." className="w-full py-5" />
                        )}
                      </div>
                    </div>
                  </aside>
                </motion.div>
              </>
            ) : (
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
              >
                <WalletConnectPrompt
                  title="Connect Wallet"
                  message="Connect your wallet to load your real profile metrics, recent activity, trust clusters, and reputation artifacts."
                  busy={walletBusy}
                  error={error}
                  eyebrow={
                    <div className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary-container/30 px-4 py-1.5">
                      <Icon name="account_balance_wallet" className="text-[0.9rem] text-secondary" />
                      <span className="font-display text-[0.62rem] font-bold uppercase tracking-[0.18em] text-secondary">
                        Account View
                      </span>
                    </div>
                  }
                  footer={<EmptyMessage message="Connect your wallet to load your account-specific profile." className="py-6 text-left" />}
                  cardClassName="max-w-2xl items-start rounded-xl border border-white/5 bg-surface-container-low p-10 text-left shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
                  buttonClassName="mt-3 rounded-xl border border-secondary/20 bg-secondary/10 px-6 py-3 font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 hover:bg-secondary/16"
                  onConnect={connect}
                />
              </motion.section>
            )}
          </div>
        </main>

        <footer className="border-t border-white/5 bg-surface-container-lowest px-8 py-12 md:pl-64">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 opacity-40 transition-opacity hover:opacity-100 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-black tracking-[-0.06em]">KOL VERDICT</span>
              <span className="font-display text-[0.54rem] font-bold uppercase tracking-[0.22em]">
                / Secure Terminal
              </span>
            </div>
            <div className="flex gap-8 font-display text-[0.58rem] font-bold uppercase tracking-[0.2em]">
              <span>Documentation</span>
              <span>Security Audit</span>
              <span>Terminals</span>
            </div>
            <div className="font-mono text-[0.62rem] text-on-surface-variant">
              BLOCK HEIGHT: 19,482,104 - LATENCY: 24MS
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
