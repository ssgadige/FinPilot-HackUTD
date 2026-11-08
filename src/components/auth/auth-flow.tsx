"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { authApi, asAuthProblem, AuthProblem } from "@/lib/auth-api";
import { useAuth } from "./auth-provider";
import { LogoutButton } from "./logout-button";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { DataState } from "@/components/ui/data-state";

function useClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}
const secondsUntil = (deadline: number, now: number) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export function AuthFlow({
  verification = false,
  reason,
}: {
  verification?: boolean;
  reason?: "expired" | "unavailable";
}) {
  const { state, challenge, setChallenge, refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [fields, setFields] = useState<{
    email?: string;
    password?: string;
    code?: string;
  }>({});
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState<"login" | "verify" | "resend" | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [notice, setNotice] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const now = useClock(Boolean(challenge) || lockedUntil > 0);
  const locked = secondsUntil(lockedUntil, now);
  const resendWait = challenge
    ? Math.min(60, secondsUntil(challenge.resendAt, now))
    : 0;
  const expiresIn = challenge
    ? Math.min(300, secondsUntil(challenge.expiresAt, now))
    : 0;
  const expired = Boolean(
    challenge && (expiresIn === 0 || challenge.expiredByServer),
  );

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (verification && challenge)
      form.current?.querySelector<HTMLInputElement>("[name=code]")?.focus();
  }, [verification, challenge]);

  function backToLogin() {
    request.current?.abort();
    request.current = null;
    setChallenge(null);
    setCode("");
    setPassword("");
    setProblem(null);
    setFields({});
    setBusy(null);
    router.replace("/login");
  }

  async function run(
    kind: "login" | "verify" | "resend",
    action: (signal: AbortSignal) => Promise<void>,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(kind);
    setProblem(null);
    setNotice("");
    try {
      await action(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = asAuthProblem(error);
      setProblem(failure);
      if (failure.kind === "expired-code") {
        setChallenge((previous) =>
          previous ? { ...previous, expiredByServer: true } : null,
        );
      }
      if (failure.kind === "rate-limit")
        setLockedUntil(Date.now() + failure.retryAfter * 1000);
      if (failure.kind === "session-expired") {
        setChallenge(null);
        setCode("");
        setPassword("");
        router.replace("/login?reason=expired");
      }
      if (kind === "verify") {
        setCode("");
        form.current?.querySelector<HTMLInputElement>("[name=code]")?.focus();
      }
    } finally {
      if (!controller.signal.aborted && request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || busy) return;
    const errors = {
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? { email: "Enter a valid email address." }
        : {}),
      ...(!password ? { password: "Enter your application password." } : {}),
    };
    setFields(errors);
    if (errors.email || errors.password) {
      form.current
        ?.querySelector<HTMLInputElement>(
          errors.email ? "[name=email]" : "[name=password]",
        )
        ?.focus();
      return;
    }
    void run("login", async (signal) => {
      const next = await authApi.login(email.trim(), password, signal);
      if (signal.aborted) return;
      setPassword("");
      setVisible(false);
      setChallenge({
        ...next,
        expiresAt: Date.now() + 300000,
        resendAt: Date.now() + 60000,
        expiredByServer: false,
      });
      router.push("/login/verify");
    });
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || expired || locked || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setFields({ code: "Enter all six digits from your latest email." });
      form.current?.querySelector<HTMLInputElement>("[name=code]")?.focus();
      return;
    }
    setFields({});
    void run("verify", async (signal) => {
      await authApi.verify(challenge.challenge_id, code, signal);
      setCode("");
      // A 200 response alone does not unlock content. Confirm the server session.
      if (await refresh(signal)) {
        if (!signal.aborted) {
          router.replace("/");
          router.refresh();
        }
      } else if (!signal.aborted) {
        setProblem(
          new AuthProblem(
            "session-expired",
            "Your session could not be confirmed after verification. Sign in again or retry when the service is available.",
          ),
        );
      }
    });
  }

  function resend() {
    if (!challenge || resendWait || locked || busy) return;
    void run("resend", async (signal) => {
      await authApi.resend(challenge.challenge_id, signal);
      if (signal.aborted) return;
      setCode("");
      setFields({});
      setChallenge((previous) =>
        previous
          ? {
              ...previous,
              expiresAt: Date.now() + 300000,
              resendAt: Date.now() + 60000,
              expiredByServer: false,
            }
          : null,
      );
      setNotice(
        "A new code was requested. Use the latest email; the previous code is no longer valid.",
      );
    });
  }

  if (state.status === "checking")
    return (
      <Card>
        <DataState
          state="loading"
          title="Checking your session"
          headingLevel={1}
        >
          Your financial workspace stays hidden until authentication is
          confirmed.
        </DataState>
      </Card>
    );
  if (state.status === "authenticated")
    return (
      <div className="page-stack">
        <PageHeading
          title="You’re signed in"
          description="The server has confirmed your session."
        />
        <Card>
          <p>Signed in as {state.session.profile.display_name}.</p>
          <p className="muted">
            Open your financial workspace. The server validates your session
            again before showing protected records.
          </p>
          <Link href="/overview" className={buttonClass()}>
            Open your workspace
          </Link>
          <LogoutButton />
        </Card>
      </div>
    );
  if (verification && !challenge)
    return (
      <div className="page-stack">
        <PageHeading
          title="Sign in to request a code"
          description="Your pending challenge is no longer available. Start again to request a fresh code."
        />
        <Card>
          <DataState
            state="empty"
            title="No active verification challenge"
            headingLevel={2}
          >
            Reloading this page clears the in-memory challenge. No code or
            password was saved.
          </DataState>
          <Button onClick={backToLogin}>Back to sign in</Button>
        </Card>
      </div>
    );

  const pending = verification && Boolean(challenge);
  const title = pending
    ? expired
      ? "That code has expired"
      : "Check your email"
    : "Welcome back";
  const actionDisabled = Boolean(busy || locked || (pending && expired));
  const reportedProblem =
    problem ?? (state.status === "unavailable" ? state.problem : null);
  return (
    <div className="page-stack">
      <PageHeading
        title={title}
        description={
          pending
            ? expired
              ? "Request a fresh code; your financial session has not started."
              : `Enter the 6-digit code sent to ${challenge?.masked_email}.`
            : "Your whole financial picture, in one protected workspace."
        }
        action={
          pending && expired ? (
            <Button
              onClick={resend}
              disabled={Boolean(busy || resendWait || locked)}
            >
              {busy === "resend" ? "Requesting code…" : "Request new code"}
            </Button>
          ) : (
            <Button
              type="submit"
              form={pending ? "verify-form" : "login-form"}
              disabled={actionDisabled}
            >
              {busy === "login"
                ? "Signing in…"
                : busy === "verify"
                  ? "Verifying…"
                  : pending
                    ? "Verify and sign in"
                    : "Continue"}
            </Button>
          )
        }
      />
      {reason === "unavailable" && (
        <DataState
          state="empty"
          title="Financial workspace unavailable"
          headingLevel={2}
        >
          Your session could not be validated. The authentication service or
          configuration may be unavailable. Financial access remains blocked.
        </DataState>
      )}
      {reason === "expired" && (
        <DataState
          state="error"
          title="Your session has expired"
          headingLevel={2}
        >
          Sign in again to continue.
        </DataState>
      )}
      {reportedProblem && (
        <DataState
          state="error"
          headingLevel={2}
          title={
            reportedProblem.kind === "network"
              ? "Connection failed"
              : reportedProblem.kind === "rate-limit"
                ? "Too many attempts"
                : reportedProblem.kind === "expired-code"
                  ? "That code has expired"
                  : reportedProblem.kind === "wrong-code"
                    ? "Check your code"
                    : "Sign-in could not continue"
          }
        >
          {reportedProblem.message}
          {reportedProblem.kind === "rate-limit" && (
            <p>
              {locked
                ? "Wait for the timer before trying again."
                : "You can try again now."}
            </p>
          )}
        </DataState>
      )}
      {locked > 0 && (
        <p className="muted" role="timer" aria-live="off">
          Try again in {locked} seconds.
        </p>
      )}
      <div className="decision-grid auth-grid">
        <div className="page-stack">
          <Card>
            <h2>{pending ? "Verification challenge" : "Sign in"}</h2>
            {pending ? (
              <form
                id="verify-form"
                ref={form}
                onSubmit={verify}
                className="page-stack"
                noValidate
                aria-busy={busy === "verify"}
              >
                <FormField
                  label="Email code"
                  placeholder="------"
                  name="code"
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  disabled={Boolean(busy) || expired}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onPaste={(event) => {
                    event.preventDefault();
                    setCode(
                      event.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    );
                  }}
                  error={
                    fields.code ??
                    (problem?.kind === "wrong-code"
                      ? "Enter the latest six-digit code."
                      : undefined)
                  }
                  hint="Six digits. You can paste the whole code."
                  required
                />
                <div className="challenge-timing">
                  <span className="muted">
                    {expired ? "Code expired" : "Code window"}
                  </span>
                  <span className="numeric" role="timer" aria-live="off">
                    {timeLabel(expired ? 0 : expiresIn)}
                  </span>
                </div>
                <p className="small muted">
                  Codes expire after five minutes. The server determines
                  validity and attempt limits.
                </p>
                <div className="inline-actions">
                  {!expired ? (
                    <Button
                      onClick={resend}
                      variant="secondary"
                      disabled={Boolean(busy || resendWait || locked)}
                    >
                      {busy === "resend"
                        ? "Requesting code…"
                        : resendWait
                          ? `Resend in ${resendWait}s`
                          : "Request new code"}
                    </Button>
                  ) : (
                    <p className="small muted" role="timer" aria-live="off">
                      {resendWait
                        ? `New code available in ${resendWait} seconds.`
                        : "New code available now."}
                    </p>
                  )}
                  <Button variant="ghost" onClick={backToLogin}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    Change email / back to sign in
                  </Button>
                </div>
                <p className="small muted" role="status">
                  {notice ||
                    (resendWait
                      ? "Resend will be available after the cooldown."
                      : "You can request a new code now.")}
                </p>
              </form>
            ) : (
              <form
                id="login-form"
                ref={form}
                onSubmit={login}
                className="page-stack"
                noValidate
                aria-busy={busy === "login"}
              >
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  error={fields.email}
                  required
                  disabled={Boolean(busy)}
                />
                <div className="password-field">
                  <FormField
                    label="Password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={fields.password}
                    hint="Use your FinPilot application password."
                    required
                    disabled={Boolean(busy)}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => setVisible((value) => !value)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                  >
                    {visible ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </Button>
                </div>
                {busy === "login" && (
                  <p role="status" className="small muted">
                    Checking your application credentials…
                  </p>
                )}
              </form>
            )}
          </Card>
          <Card>
            <h2>{pending ? "Use your latest code" : "Demo workspace"}</h2>
            <p className="muted">
              {pending
                ? "Sending another code invalidates the previous code. No financial session starts until verification succeeds."
                : "Use fictional FinPilot credentials. Institution credentials are separate. Never enter a real banking password."}
            </p>
          </Card>
        </div>
        <div className="page-stack">
          <Card>
            <h2>{pending ? "Local email demo" : "What happens next"}</h2>
            {pending ? (
              <p className="muted">
                When the backend is configured, Mailpit receives messages for
                fictional addresses. No real inbox is implied.
              </p>
            ) : (
              <ol className="auth-steps">
                <li>Application password checked</li>
                <li>Email code sent</li>
                <li>Session starts after verification</li>
              </ol>
            )}
          </Card>
          {expired && (
            <Card>
              <h2>Safe failure</h2>
              <p className="muted">
                Codes are single-use and have an attempt limit. Request a fresh
                code to continue.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
