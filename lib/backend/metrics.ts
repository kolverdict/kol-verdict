import { formatCompactNumber } from "@/lib/backend/mappers";

export function calculateTrustScore(loveCount: number, hateCount: number, initialTrustScore = 50) {
  const totalVotes = loveCount + hateCount;

  if (totalVotes === 0) {
    return Math.max(0, Math.min(100, initialTrustScore));
  }

  const ratio = (loveCount - hateCount) / totalVotes;
  return Math.max(0, Math.min(100, Number((50 + ratio * 50).toFixed(1))));
}

export function calculateControversyScore(loveCount: number, hateCount: number) {
  const totalVotes = loveCount + hateCount;
  if (totalVotes === 0) {
    return 0;
  }

  return Number((100 - (Math.abs(loveCount - hateCount) / totalVotes) * 100).toFixed(1));
}

export function calculateTrendingScore(loveCount: number, hateCount: number, totalComments: number) {
  const raw = loveCount * 0.62 + totalComments * 1.8 - hateCount * 0.25;
  return Math.max(0, Number(raw.toFixed(1)));
}

export function buildTrendLabel(trendingScore: number) {
  if (trendingScore >= 90) return "+12.4% GAIN";
  if (trendingScore >= 75) return "+8.1% GAIN";
  if (trendingScore >= 55) return "+0.4% STABLE";
  return "-4.2% LOSS";
}

export function buildFlowLabel(loveCount: number) {
  return `${formatCompactNumber(loveCount * 340).toUpperCase()} FLOWERS`;
}
