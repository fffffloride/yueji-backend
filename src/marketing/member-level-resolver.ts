import { LessThanOrEqual } from "typeorm";
import type { EntityManager } from "typeorm";

import { MemberLevel } from "./entities/member-level.entity";
import type { Member } from "@/member/entities/member.entity";

export async function resolveEffectiveMemberLevel(
  manager: EntityManager,
  member: Pick<Member, "levelId" | "totalSpent">
): Promise<MemberLevel | null> {
  if (member.levelId) {
    const assigned = await manager.findOne(MemberLevel, {
      where: { id: member.levelId, status: 1, isDeleted: 0 },
    });
    if (assigned) return assigned;
  }
  return manager.findOne(MemberLevel, {
    where: {
      thresholdAmount: LessThanOrEqual(member.totalSpent ?? 0),
      status: 1,
      isDeleted: 0,
    },
    order: { thresholdAmount: "DESC" },
  });
}
