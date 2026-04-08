import { RouteStateScreen } from "@/components/route-state-screen";

export default function Loading() {
  return (
    <RouteStateScreen
      navKey="leaderboard"
      title="Loading Ranking"
      message="Compiling trusted, hated, and trending signals from the registry."
      icon="leaderboard"
      tone="secondary"
      loading
    />
  );
}
