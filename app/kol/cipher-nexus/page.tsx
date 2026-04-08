import { KolProfileScreen } from "@/components/screens/kol-profile-screen";
import { isAppError } from "@/lib/backend/errors";
import { getKolProfile } from "@/lib/backend/kols";
import { getCommentFeeAmount } from "@/lib/backend/payment";
import { notFound } from "next/navigation";

type KolProfilePageProps = {
  searchParams: Promise<{
    modal?: string | string[];
  }>;
};

export default async function KolProfilePage({ searchParams }: KolProfilePageProps) {
  const params = await searchParams;
  const modal = Array.isArray(params.modal) ? params.modal[0] : params.modal;
  let profile: Awaited<ReturnType<typeof getKolProfile>>;
  let feeAmount: ReturnType<typeof getCommentFeeAmount>;

  try {
    [profile, feeAmount] = await Promise.all([getKolProfile("cipher-nexus"), Promise.resolve(getCommentFeeAmount())]);
  } catch (error) {
    if (isAppError(error) && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  return <KolProfileScreen profile={profile} feeAmount={feeAmount} initialModal={modal === "verify-claim"} />;
}
