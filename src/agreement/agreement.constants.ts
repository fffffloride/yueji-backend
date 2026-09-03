export enum AgreementType {
  USER_AGREEMENT = "USER_AGREEMENT",
  PRIVACY_POLICY = "PRIVACY_POLICY",
  MEDICAL_INFORMED_CONSENT = "MEDICAL_INFORMED_CONSENT",
}

export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  [AgreementType.USER_AGREEMENT]: "用户协议",
  [AgreementType.PRIVACY_POLICY]: "隐私政策",
  [AgreementType.MEDICAL_INFORMED_CONSENT]: "用户就诊告知及知情同意书",
};
