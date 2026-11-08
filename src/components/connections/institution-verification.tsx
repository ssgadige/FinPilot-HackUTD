import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { DataState } from "@/components/ui/data-state";

/** No verify/resend endpoint is invented. This step cannot release account access. */
export function InstitutionVerification({
  providerName,
  maskedRecipient,
}: {
  providerName: string;
  maskedRecipient: string | null;
}) {
  return (
    <div className="page-stack">
      <h3>Verify your institution email</h3>
      <p className="muted">
        {providerName} requires a separate email verification before account
        selection.
      </p>
      {maskedRecipient && (
        <p>
          Reported recipient: <strong>{maskedRecipient}</strong>. Delivery is
          unconfirmed.
        </p>
      )}
      <DataState
        state="empty"
        title="Institution email verification unavailable"
      >
        FP-11 has not supplied a confirmed verify/resend contract. No account
        preview is exposed, and no accounts have been linked.
      </DataState>
      <FormField
        label="Institution email code"
        name="institution_code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled
        hint="Verification becomes available after the backend contract is confirmed."
      />
      <div className="inline-actions">
        <Button disabled>Verify institution email</Button>
        <Button variant="secondary" disabled>
          Resend institution code
        </Button>
      </div>
    </div>
  );
}
