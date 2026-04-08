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
      navKey="add"
      title="Form Unavailable"
      message="The KOL registration surface could not be rendered right now."
      icon="warning"
      tone="tertiary"
      actionLabel="Retry Form"
      onAction={reset}
    />
  );
}
