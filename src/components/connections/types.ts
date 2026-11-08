/** Internal post-verification view model, NOT an agreed FP-11 wire schema.
 * No production adapter currently creates it: institution OTP integration is blocked.
 */
export type VerifiedInstitutionPreview = {
  institutionId: string;
  institutionName: string;
  previewToken: string;
  expiresAt: string;
  consentVersion: string;
  accounts: {
    id: string;
    label: string;
    lastFour: string;
    records: string[];
  }[];
};
/** Only supplied by a confirmed server receipt or future confirmed listing adapter. */
export type ConfirmedConnection = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: "active" | "revoked";
  lastSuccessfulSync: string | null;
  accounts: { id: string; label: string; lastFour: string }[];
};
