import { getEnv } from "@/lib/env";

export function getCommentFeeAmount() {
  return getEnv().KOL_PROOF_COMMENT_FEE_ETH;
}
