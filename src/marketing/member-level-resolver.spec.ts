import type { EntityManager } from "typeorm";

import { resolveEffectiveMemberLevel } from "./member-level-resolver";

describe("resolveEffectiveMemberLevel", () => {
  it("已分配等级停用后按累计消费回退到有效等级", async () => {
    const fallback = { id: "2", name: "有效等级", status: 1 };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(fallback),
    } as unknown as EntityManager;

    await expect(
      resolveEffectiveMemberLevel(manager, { levelId: "1", totalSpent: 10_000 })
    ).resolves.toBe(fallback);
    expect(manager.findOne).toHaveBeenCalledTimes(2);
    expect(manager.findOne).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      expect.objectContaining({ where: { id: "1", status: 1, isDeleted: 0 } })
    );
  });
});
