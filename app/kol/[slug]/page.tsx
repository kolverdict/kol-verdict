import { KolProfileScreen } from "@/components/screens/kol-profile-screen";
import { isAppError } from "@/lib/backend/errors";
import { getKolProfile } from "@/lib/backend/kols";
import { getCommentFeeAmount } from "@/lib/backend/payment";
import { notFound } from "next/navigation";

type KolProfilePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    modal?: string | string[];
  }>;
};

export default async function KolDynamicProfilePage({ params, searchParams }: KolProfilePageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const modal = Array.isArray(query.modal) ? query.modal[0] : query.modal;
  let profile: Awaited<ReturnType<typeof getKolProfile>>;
  let feeAmount: ReturnType<typeof getCommentFeeAmount>;

  try {
    [profile, feeAmount] = await Promise.all([getKolProfile(slug), Promise.resolve(getCommentFeeAmount())]);
  } catch (error) {
    if (isAppError(error) && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  return <KolProfileScreen profile={profile} feeAmount={feeAmount} initialModal={modal === "verify-claim"} />;
}
