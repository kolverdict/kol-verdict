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
      title="Profile Unavailable"
      message="Your profile metrics could not be loaded right now."
      icon="warning"
      tone="tertiary"
      actionLabel="Retry Profile"
      onAction={reset}
    />
  );
}
