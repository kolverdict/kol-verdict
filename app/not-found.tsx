import { RouteStateScreen } from "@/components/route-state-screen";

export default function NotFound() {
  return (
    <RouteStateScreen
      navKey="home"
      title="Route Not Found"
      message="That surface is not present in the active registry build. Return to the feed and continue from a live route."
      icon="search_off"
      tone="secondary"
      actionLabel="Back To Feed"
      actionHref="/"
    />
  );
}
