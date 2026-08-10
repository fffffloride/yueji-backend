/**
 * 当前登录会员信息（挂载于 request.member）
 */
export interface CurrentMemberInfo {
  /** 会员ID */
  memberId: string;
  /** 微信openid */
  openid?: string;
}
