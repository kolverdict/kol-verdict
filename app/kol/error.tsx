"use client";

import { RouteStateScreen } from "@/components/route-state-screen";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteStateScreen
      navKey="profile"
      title="Profile Sync Failed"
      message="The KOL profile could not be rendered right now."
      icon="warning"
      tone="tertiary"
      actionLabel="Retry Profile"
      onAction={reset}
    />
  );
}
