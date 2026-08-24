import { commissionAmount, effectiveRate, highestUpgradeLevel } from "./distribution.rules";

describe("distribution rules", () => {
  it("calculates snapshots and selects only a higher eligible level", () => {
    expect(commissionAmount(999, 1250)).toBe(124);
    expect(effectiveRate(800, 1200)).toBe(800);
    expect(effectiveRate(null, 1200)).toBe(1200);
    expect(
      highestUpgradeLevel(
        [
          { id: "1", rank: 1, upgradeSalesAmount: 0 },
          { id: "2", rank: 2, upgradeSalesAmount: 5_000_000 },
          { id: "3", rank: 3, upgradeSalesAmount: 10_000_000 },
        ],
        10_000_000,
        1
      )?.id
    ).toBe("3");
    expect(
      highestUpgradeLevel([{ id: "1", rank: 1, upgradeSalesAmount: 0 }], 10, 1)
    ).toBeUndefined();
  });
});
