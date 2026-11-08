/** Internal view model decoded only from a successfully verified institution challenge. */
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
/** Only supplied by a confirmed server receipt or authenticated listing adapter. */
export type ConfirmedConnection = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: "active" | "revoked";
  lastSuccessfulSync: string | null;
  accounts: { id: string; label: string; lastFour: string }[];
};
