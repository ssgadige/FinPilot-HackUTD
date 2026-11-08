"use client";

import { useState, useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DataState } from "@/components/ui/data-state";

export function PatternForm() {
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);
  const [retryExample, setRetryExample] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("amount") ?? "");
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
      setError("Enter a positive USD amount with at most two decimal places.");
      setComplete(false);
      form.current?.querySelector<HTMLInputElement>("[name=amount]")?.focus();
      return;
    }
    setError(undefined);
    setComplete(true);
  }
  return (
    <form ref={form} onSubmit={submit} noValidate className="page-stack">
      <div className="page-stack">
        <FormField
          label="Amount (USD)"
          name="amount"
          placeholder="0.00"
          inputMode="decimal"
          hint="UI example only. No funds will move."
          error={error}
          required
        />
        <FormField label="Date (optional)" name="date" type="date" />
      </div>
      <SelectField
        label="Account"
        name="account"
        hint="An illustrative option, not a connected account."
      >
        <option value="example">Example checking · 1234</option>
      </SelectField>
      <div className="inline-actions">
        <Button type="submit">Validate example</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setRetryExample(true);
            setComplete(false);
          }}
        >
          Show error example
        </Button>
        <Button disabled>Unavailable action</Button>
      </div>
      {complete && (
        <DataState state="success" title="Example validated">
          Nothing was saved. Your entered values remain in the form.
        </DataState>
      )}
      {retryExample && (
        <DataState
          state="error"
          title="Recoverable error example"
          action={
            <Button variant="secondary" onClick={() => setRetryExample(false)}>
              Dismiss error example
            </Button>
          }
        >
          This is an intentional UI example. Your form values are preserved.
        </DataState>
      )}
    </form>
  );
}
