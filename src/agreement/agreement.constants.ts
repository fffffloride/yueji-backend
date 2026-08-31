export enum AgreementType {
  USER_AGREEMENT = "USER_AGREEMENT",
  PRIVACY_POLICY = "PRIVACY_POLICY",
}

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  [AgreementType.USER_AGREEMENT]: "用户协议",
  [AgreementType.PRIVACY_POLICY]: "隐私政策",
};
