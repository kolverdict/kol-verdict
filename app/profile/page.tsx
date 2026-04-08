import { UserProfileScreen } from "@/components/screens/user-profile-screen";
import { getCurrentUserProfileView } from "@/lib/backend/profiles";

export default async function ProfilePage() {
  const userProfile = await getCurrentUserProfileView();

  return <UserProfileScreen userProfile={userProfile} />;
}
