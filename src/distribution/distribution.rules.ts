export interface UpgradeLevel {
  id: string;
  rank: number;
  upgradeSalesAmount: number;
}

export function effectiveRate(customRate: number | null | undefined, levelRate: number): number {
  return customRate ?? levelRate;
}

export function commissionAmount(baseAmount: number, rateBps: number): number {
  return Math.floor((baseAmount * rateBps) / 10000);
}

export function highestUpgradeLevel(
  levels: UpgradeLevel[],
  salesAmount: number,
  currentRank: number
): UpgradeLevel | undefined {
  return levels
    .filter((level) => level.rank > currentRank && level.upgradeSalesAmount <= salesAmount)
    .sort((a, b) => b.rank - a.rank)[0];
}
