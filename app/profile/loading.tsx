import { RouteStateScreen } from "@/components/route-state-screen";

export default function Loading() {
  return (
    <RouteStateScreen
      navKey="profile"
      title="Loading Profile"
      message="Syncing your wallet reputation, recent activity, and trust clusters."
      icon="account_circle"
      tone="secondary"
      loading
    />
  );
}
