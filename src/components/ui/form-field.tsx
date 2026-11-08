"use client";

import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

type FieldProps = { label: string; hint?: string; error?: string };

export function FormField({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const description =
    [hint && `${fieldId}-hint`, error && `${fieldId}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={description}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="muted small">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> &
  FieldProps & { children: ReactNode }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint && `${fieldId}-hint`, error && `${fieldId}-error`]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {children}
      </select>
      {hint && (
        <p id={`${fieldId}-hint`} className="muted small">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
