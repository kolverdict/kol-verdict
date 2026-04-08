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
      navKey="home"
      title="Feed Unavailable"
      message="The registry feed could not be rendered right now."
      icon="warning"
      tone="tertiary"
      actionLabel="Retry Feed"
      onAction={reset}
    />
  );
}
