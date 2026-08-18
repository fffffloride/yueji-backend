import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import type { Member } from "./entities/member.entity";

export function ensureMemberEnabled(member: Member | null): asserts member is Member {
  if (!member || member.status !== 1) {
    throw new BusinessException({
      ...ErrorCode.USER_LOGIN_EXCEPTION,
      msg: "账号已被禁用或不存在，请联系客服",
    });
  }
}
