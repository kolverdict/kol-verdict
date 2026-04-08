import { RouteStateScreen } from "@/components/route-state-screen";

export default function NotFound() {
  return (
    <RouteStateScreen
      navKey="profile"
      title="KOL Not Found"
      message="No active registry entry matched this profile. Return to the leaderboard and choose another analyst."
      icon="search_off"
      tone="tertiary"
      actionLabel="Back To Ranking"
      actionHref="/leaderboard"
    />
  );
}
