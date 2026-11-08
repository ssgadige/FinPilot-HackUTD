import type { Institution } from "../../src/lib/connections-api";
import type {
  ConfirmedConnection,
  VerifiedInstitutionPreview,
} from "../../src/components/connections/types";

// Public provider metadata and synthetic post-verification labels. No credentials or OTPs.
export const providerFixtures: Institution[] = [
  { id: "pnc", name: "PNC", category: "banks" },
  { id: "bofa", name: "Bank of America", category: "banks" },
  { id: "chase", name: "Chase", category: "banks" },
  { id: "amex", name: "American Express", category: "cards" },
  { id: "fidelity", name: "Fidelity", category: "investments" },
  { id: "demo-auto", name: "Demo Auto Finance", category: "loans" },
  { id: "paypal", name: "PayPal", category: "wallets" },
];
export function verifiedPreviewFixture(): VerifiedInstitutionPreview {
  return {
    institutionId: "chase",
    institutionName: "Chase",
    previewToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    consentVersion: "test-consent-version",
    accounts: [
      {
        id: "test-checking",
        label: "Example checking",
        lastFour: "1000",
        records: [
          "Balance snapshot as of November 7, 2026",
          "Transactions: November 1, 2025 through October 31, 2026",
        ],
      },
      {
        id: "test-savings",
        label: "Example savings",
        lastFour: "1001",
        records: [
          "Balance snapshot as of November 7, 2026",
          "Transactions: November 1, 2024 through October 31, 2026",
        ],
      },
    ],
  };
}
export function confirmedConnectionFixture(): ConfirmedConnection {
  return {
    id: "test-connection",
    institutionId: "chase",
    institutionName: "Chase",
    status: "active",
    lastSuccessfulSync: "2026-11-07T12:00:00Z",
    accounts: [
      { id: "test-checking", label: "Example checking", lastFour: "1000" },
    ],
  };
}
