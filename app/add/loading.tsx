import { RouteStateScreen } from "@/components/route-state-screen";

export default function Loading() {
  return (
    <RouteStateScreen
      navKey="add"
      title="Loading Registry Form"
      message="Preparing the registration surface and identity preview card."
      icon="add_box"
      tone="secondary"
      loading
    />
  );
}
