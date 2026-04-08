"use client";

import { DesktopShell, MobileShell } from "@/components/app-shell";
import { CyanButton, GhostButton, Icon, Pill, PrimaryButton, SurfaceCard } from "@/components/ui";
import { brandAvatar, type NavKey } from "@/lib/mock-data";

type ShellPreviewProps = {
  navKey: NavKey;
  title: string;
  subtitle: string;
  eyebrow?: string;
};

export function ShellPreview({
  navKey,
  title,
  subtitle,
  eyebrow = "Shell Foundation",
}: ShellPreviewProps) {
  return (
    <>
      <MobileShell navKey={navKey} avatar={brandAvatar} eyebrow="Shared Shell">
        <ShellPreviewContent title={title} subtitle={subtitle} compact />
      </MobileShell>

      <DesktopShell
        navKey={navKey}
        avatar={brandAvatar}
        searchPlaceholder="Search shell primitives..."
        className="overflow-y-auto thin-scrollbar"
      >
        <ShellPreviewContent title={title} subtitle={subtitle} eyebrow={eyebrow} />
      </DesktopShell>
    </>
  );
}

function ShellPreviewContent({
  title,
  subtitle,
  eyebrow = "Shell Foundation",
  compact = false,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  compact?: boolean;
}) {
  return (
    <section className={`relative ${compact ? "space-y-6 pt-2" : "space-y-8 pb-8 pt-4"}`}>
      <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-secondary/7 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/7 blur-[130px]" />

      <div className="relative space-y-4">
        <div className="type-section text-secondary">{eyebrow}</div>
        <h1 className="type-hero max-w-[12ch] text-white">{title}</h1>
        <p className={`${compact ? "max-w-[20rem]" : "max-w-[38rem]"} type-body-lg`}>{subtitle}</p>
      </div>

      <div className={`relative ${compact ? "space-y-4" : "grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"}`}>
        <SurfaceCard className={`${compact ? "space-y-4 rounded-[1.8rem] p-5" : "space-y-5 rounded-[1.35rem] p-6"} shell-card`}>
          <div className="flex items-center justify-between">
            <div className="type-section text-on-surface-variant">Color Tokens</div>
            <Pill tone="secondary">Shared palette</Pill>
          </div>

          <div className={`grid ${compact ? "grid-cols-2 gap-3" : "grid-cols-5 gap-4"}`}>
            {[
              ["Primary", "bg-primary", "text-on-primary"],
              ["Secondary", "bg-secondary", "text-on-secondary"],
              ["Tertiary", "bg-tertiary", "text-on-tertiary"],
              ["Surface", "bg-surface-container-high", "text-white"],
              ["Glass", "glass-card-shell", "text-white"],
            ].map(([label, swatchClass, textClass]) => (
              <div key={label} className="space-y-3">
                <div className={`h-18 rounded-[1rem] ${swatchClass}`} />
                <div className={`type-label ${textClass === "text-white" ? "text-white" : textClass}`}>{label}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className={`${compact ? "space-y-4 rounded-[1.8rem] p-5" : "space-y-5 rounded-[1.35rem] p-6"} glass-card-shell`}>
          <div className="type-section text-on-surface-variant">Typography Scale</div>
          <div className="space-y-3">
            <div className="type-display-xl text-white">Display XL</div>
            <div className="type-display-lg text-white">Display LG</div>
            <div className="type-body-lg">Body Large used for shell summaries and contextual copy.</div>
            <div className="type-body-sm">Body Small handles metadata, helper text, and card descriptions.</div>
            <div className="type-label text-primary">Label / Navigation / Tabs</div>
          </div>
        </SurfaceCard>
      </div>

      <div className={`relative ${compact ? "space-y-4" : "grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"}`}>
        <SurfaceCard className={`${compact ? "space-y-4 rounded-[1.8rem] p-5" : "space-y-5 rounded-[1.35rem] p-6"} shell-card`}>
          <div className="flex items-center justify-between">
            <div className="type-section text-on-surface-variant">Button Variants</div>
            <div className="type-label text-on-surface-variant">Shared actions</div>
          </div>
          <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-3`}>
            <PrimaryButton className="justify-center rounded-[1rem]">Primary</PrimaryButton>
            <CyanButton className="justify-center rounded-[1rem]">Secondary</CyanButton>
            <GhostButton className="justify-center rounded-[1rem]">Ghost</GhostButton>
          </div>
          <div className="type-body-sm">
            Buttons use the same premium rounded geometry, ghost borders, and glow weights shown across the references.
          </div>
        </SurfaceCard>

        <div className={`grid ${compact ? "grid-cols-1 gap-4" : "grid-cols-3 gap-4"}`}>
          {[
            ["Surface Card", "Dark nested panel for body sections.", "dataset", "shell-card"],
            ["Glass Card", "Blurred floating panel for top-layer actions.", "filter_b_and_w", "glass-card-shell"],
            ["Stat Card", "Compact metric style for dashboards and profile blocks.", "query_stats", "shell-stat-card"],
          ].map(([label, copy, icon, cardClass]) => (
            <SurfaceCard key={label} className={`rounded-[1.2rem] p-5 ${cardClass}`}>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[0.9rem] bg-black/20 text-secondary">
                <Icon name={icon} className="text-[1.3rem]" />
              </div>
              <div className="type-display-lg text-white">{label}</div>
              <div className="mt-3 type-body-sm">{copy}</div>
            </SurfaceCard>
          ))}
        </div>
      </div>

      <SurfaceCard className={`${compact ? "rounded-[1.8rem] p-5" : "rounded-[1.35rem] p-6"} shell-card`}>
        <div className="flex items-center justify-between">
          <div className="type-section text-on-surface-variant">Shell Composition</div>
          <Pill tone="primary">Reference-aligned</Pill>
        </div>

        <div className={`mt-5 grid ${compact ? "grid-cols-1 gap-4" : "gap-4 md:grid-cols-3"}`}>
          {[
            ["Desktop left rail", "Fixed dark obsidian sidebar with active nav highlight and mint CTA."],
            ["Desktop top bar", "Search field, utility icons, and avatar in a blurred header without duplicate route links."],
            ["Mobile chrome", "Compact top bar plus bottom nav with filled active state and rounded tray."],
          ].map(([label, copy]) => (
            <div key={label} className="rounded-[1rem] bg-surface-container-high px-4 py-4">
              <div className="type-label text-primary">{label}</div>
              <div className="mt-3 type-body-sm">{copy}</div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </section>
  );
}
