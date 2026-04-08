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
      navKey="leaderboard"
      title="Ranking Unavailable"
      message="The global ranking surface could not be rendered right now."
      icon="warning"
      tone="tertiary"
      actionLabel="Retry Ranking"
      onAction={reset}
    />
  );
}
