"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import {
  connectionsApi,
  connectionProblem,
  type ConnectionProblem,
  type Institution,
} from "@/lib/connections-api";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { ConnectionFeedback, useConnectionClock } from "./connection-feedback";
import { InstitutionVerification } from "./institution-verification";

export function ProviderLinkDialog({
  provider,
  csrfToken,
  onClose,
}: {
  provider: Institution;
  csrfToken: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<ConnectionProblem | null>(null);
  const [pending, setPending] = useState<{
    maskedRecipient: string | null;
  } | null>(null);
  const [validation, setValidation] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const now = useConnectionClock();
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    const element = dialog.current;
    const formElement = form.current;
    element?.showModal();
    return () => {
      controller.current?.abort();
      formElement?.reset();
      element?.close();
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const element = dialog.current;
    if (element) {
      element.scrollTop = 0;
      element
        .querySelector<HTMLElement>("#provider-link-title")
        ?.focus({ preventScroll: true });
    }
  }, [pending]);

  function close() {
    controller.current?.abort();
    form.current?.reset();
    setVisible(false);
    // Release the native modal's inert backdrop before restoring trigger focus.
    dialog.current?.close();
    onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current || wait) return;
    const element = event.currentTarget;
    const values = new FormData(element);
    const username = String(values.get("demo_username") ?? "").trim();
    const password = String(values.get("demo_password") ?? "");
    // Reset BEFORE starting the request, including missing-field and failure paths.
    element.reset();
    values.delete("demo_username");
    values.delete("demo_password");
    setVisible(false);
    if (!username || !password) {
      setValidation(
        "Enter both generated institution credentials. The fields have been cleared.",
      );
      element.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setValidation("");
    setProblem(null);
    try {
      const result = await connectionsApi.startPreview(
        provider.id,
        username,
        password,
        { csrfToken, signal: request.signal },
      );
      if (!request.signal.aborted) setPending(result);
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = connectionProblem(error);
      setProblem(failure);
      if (failure.kind === "rate-limit")
        setRetryAt(Date.now() + failure.retryAfter * 1000);
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="provider-link-title"
      className="connection-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="page-stack">
        <div className="card-heading">
          <h2 id="provider-link-title" tabIndex={-1}>
            Connect {provider.name}
          </h2>
          <Button
            variant="ghost"
            aria-label="Cancel institution linking"
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
        <p className="simulation-warning">
          Simulation only. Do not enter real banking credentials.
        </p>
        <p className="muted small">
          This form contacts only FinPilot’s local simulator, never the actual
          bank.
        </p>
        {pending ? (
          <InstitutionVerification
            providerName={provider.name}
            maskedRecipient={pending.maskedRecipient}
          />
        ) : (
          <form
            ref={form}
            onSubmit={submit}
            className="page-stack"
            noValidate
            aria-busy={busy}
          >
            <h3>Institution credentials</h3>
            <FormField
              label="Demo email or username"
              name="demo_username"
              autoComplete="off"
              required
              disabled={busy}
            />
            <div className="password-field">
              <FormField
                label="Generated institution password"
                name="demo_password"
                type={visible ? "text" : "password"}
                autoComplete="off"
                required
                disabled={busy}
              />
              <Button
                variant="ghost"
                onClick={() => setVisible((value) => !value)}
                aria-label={
                  visible
                    ? "Hide institution password"
                    : "Show institution password"
                }
                aria-pressed={visible}
              >
                {visible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </Button>
            </div>
            {validation && (
              <p className="field-error" role="alert">
                {validation}
              </p>
            )}
            <ConnectionFeedback problem={problem} />
            {wait > 0 && (
              <p role="timer" aria-live="off" className="small muted">
                Try again in {wait} seconds.
              </p>
            )}
            <Button type="submit" disabled={busy || wait > 0}>
              {busy
                ? "Contacting simulator…"
                : "Continue to institution verification"}
            </Button>
            <p className="small muted" role="status">
              {busy
                ? "Credentials cleared. Waiting for the simulator."
                : "Credentials are cleared after every submission."}
            </p>
          </form>
        )}
        <Button variant="secondary" onClick={close}>
          Cancel and return to providers
        </Button>
      </div>
    </dialog>
  );
}
