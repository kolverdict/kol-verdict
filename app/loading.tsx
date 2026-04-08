import { RouteStateScreen } from "@/components/route-state-screen";

export default function Loading() {
  return (
    <RouteStateScreen
      navKey="home"
      title="Loading Feed"
      message="Syncing the featured KOL queue and preparing the swipe surface."
      icon="radar"
      tone="secondary"
      loading
    />
  );
}
