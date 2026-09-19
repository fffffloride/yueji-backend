export enum AgreementType {
  USER_AGREEMENT = "USER_AGREEMENT",
  PRIVACY_POLICY = "PRIVACY_POLICY",
  MEDICAL_INFORMED_CONSENT = "MEDICAL_INFORMED_CONSENT",
  ACCOUNT_CANCELLATION_NOTICE = "ACCOUNT_CANCELLATION_NOTICE",
  ABOUT_US = "ABOUT_US",
}

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  [AgreementType.USER_AGREEMENT]: "用户协议",
  [AgreementType.PRIVACY_POLICY]: "隐私政策",
  [AgreementType.MEDICAL_INFORMED_CONSENT]: "用户就诊告知及知情同意书",
  [AgreementType.ACCOUNT_CANCELLATION_NOTICE]: "注销须知",
  [AgreementType.ABOUT_US]: "关于我们",
};
