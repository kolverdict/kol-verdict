import { RouteStateScreen } from "@/components/route-state-screen";

export default function Loading() {
  return (
    <RouteStateScreen
      navKey="profile"
      title="Loading KOL Profile"
      message="Syncing live metrics, evidence-backed comments, and proof points."
      icon="hub"
      tone="secondary"
      loading
    />
  );
}
