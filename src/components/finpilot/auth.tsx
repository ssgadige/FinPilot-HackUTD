"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, type Profile } from "../../lib/finpilot";
import { Card, Icon, Loading, Notice, useAction } from "./ui";
type Challenge = {
  challenge_id: string;
  masked_email: string;
  expires: number;
  resend: number;
};
export function AuthScreen({ verify = false }: { verify?: boolean }) {
  const router = useRouter(),
    action = useAction();
  const [challenge, setChallenge] = useState<Challenge | null>(null),
    [now, setNow] = useState(Date.now()),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [restored, setRestored] = useState(!verify);
  useEffect(() => {
    if (verify) {
      try {
        const saved = sessionStorage.getItem("fp_challenge");
        if (saved) setChallenge(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem("fp_challenge");
      }
    }
    setRestored(true);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [verify]);
  const expired = !!challenge && now >= challenge.expires;
  const remaining = challenge
    ? Math.max(0, Math.ceil((challenge.expires - now) / 1000))
    : 0;
  const save = (c: Challenge) => {
    sessionStorage.setItem("fp_challenge", JSON.stringify(c));
    setChallenge(c);
  };
  const login = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    void action.run(async () => {
      const startedAt = Date.now();
      const result = await api<{ challenge_id: string; masked_email: string }>(
        "auth/login",
        "POST",
        {
          email: String(data.get("email")),
          password: String(data.get("password")),
        },
      );
      form.reset();
      save({
        ...result,
        expires: startedAt + 300000,
        resend: startedAt + 60000,
      });
      router.push("/verify");
    });
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void action.run(async () => {
      await api<Profile>("auth/verify", "POST", {
        challenge_id: challenge!.challenge_id,
        code,
      });
      setCode("");
      sessionStorage.removeItem("fp_challenge");
      router.replace("/overview");
      router.refresh();
    });
  };
  return (
    <div className="auth-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="auth-sidebar">
        <Link href="/sign-in" className="brand">
          <span className="brand-mark">
            <Icon name="spark" size={24} />
          </span>
          finpilot<span className="brand-period">.</span>
        </Link>
        <div className="auth-pitch">
          <span className="eyebrow">YOUR FINANCIAL COMMAND CENTER</span>
          <h2>
            Your financial picture.
            <br />
            <em>A coordinated next move.</em>
          </h2>
          <p>
            Bring your accounts, priorities and possibilities together in one
            protected workspace.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div>
              <Icon name="wallet" />
              <span>One clear picture</span>
              <Icon name="check" size={15} />
            </div>
            <div>
              <Icon name="target" />
              <span>Your priorities, aligned</span>
              <Icon name="check" size={15} />
            </div>
            <div>
              <Icon name="shield" />
              <span>You stay in control</span>
              <Icon name="check" size={15} />
            </div>
          </div>
        </div>
        <span className="auth-footer">
          <Icon name="shield" size={16} /> Built for clarity. Designed around
          you.
        </span>
      </aside>
      <main id="main-content" className="auth-main">
        <div className="auth-top">
          <span className="breadcrumb">FinPilot / Secure sign in</span>
          <span className="badge">
            <span className="dot" /> SIMULATED DATA
          </span>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {verify ? "ONE MORE STEP" : "WELCOME TO FINPILOT"}
          </span>
          <h1>
            {verify
              ? expired
                ? "That code has expired"
                : "Check your email"
              : "Welcome back"}
          </h1>
          <p className="subtitle">
            {verify
              ? challenge
                ? `Enter the 6-digit code sent to ${challenge.masked_email}.`
                : "Start with your application email and password to receive a code."
              : "Your whole financial picture, in one protected workspace."}
          </p>
          {action.error && <Notice tone="error">{action.error}</Notice>}
          {sent && (
            <Notice tone="success">
              A new code was sent. Use the latest email.
            </Notice>
          )}
          {verify ? (
            <>
              {!restored ? (
                <Card title="Restoring verification">
                  <Loading />
                </Card>
              ) : challenge ? (
                <Card title="Verify your email">
                  <form onSubmit={submit} className="form-stack">
                    <label>
                      Email code
                      <input
                        className="otp-input"
                        aria-label="Email code"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        disabled={action.busy || expired}
                      />
                    </label>
                    <div className="split small muted">
                      <span>
                        {expired
                          ? "Request another code to continue."
                          : `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
                      </span>
                      <Icon name="shield" size={15} />
                    </div>
                    <button
                      className="button full"
                      disabled={action.busy || expired || code.length !== 6}
                    >
                      {action.busy ? "Verifying…" : "Verify and sign in"}
                      <Icon name="arrow" size={17} />
                    </button>
                  </form>
                  <div className="resend-row">
                    <span>Didn’t receive the email?</span>
                    <button
                      className="text-button"
                      disabled={
                        action.busy || expired || now < challenge.resend
                      }
                      onClick={() =>
                        void action.run(async () => {
                          await api("auth/resend", "POST", {
                            challenge_id: challenge.challenge_id,
                          });
                          save({
                            ...challenge,
                            expires: Date.now() + 300000,
                            resend: Date.now() + 60000,
                          });
                          setCode("");
                          setSent(true);
                        })
                      }
                    >
                      {now < challenge.resend
                        ? `Resend in ${Math.ceil((challenge.resend - now) / 1000)}s`
                        : "Resend code"}
                    </button>
                  </div>
                  {expired && (
                    <p className="small muted">
                      Your challenge has ended.{" "}
                      <Link href="/sign-in">Sign in again</Link> to request a
                      new code.
                    </p>
                  )}
                </Card>
              ) : (
                <Notice tone="warning">
                  There is no pending verification.{" "}
                  <Link href="/sign-in">Return to sign in</Link>.
                </Notice>
              )}
              <Link href="/sign-in" className="back-link">
                ← Back to sign in
              </Link>
            </>
          ) : (
            <Card title="Sign in">
              <form onSubmit={login} className="form-stack">
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.test"
                    required
                    maxLength={254}
                    disabled={action.busy}
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your application password"
                    required
                    maxLength={256}
                    disabled={action.busy}
                  />
                </label>
                <button className="button full" disabled={action.busy}>
                  {action.busy ? "Sending verification…" : "Continue"}
                  <Icon name="arrow" size={17} />
                </button>
                <span className="small muted center">
                  Your session begins after email verification.
                </span>
              </form>
            </Card>
          )}
          <Notice>
            <strong>Demo workspace</strong>
            <p>
              Use generated fictional credentials only. Institution credentials
              are separate. Never enter a real bank password.
            </p>
          </Notice>
          <div className="auth-steps">
            <span>
              <b>01</b> Password checked securely
            </span>
            <span>
              <b>02</b> Email code sent to Mailpit
            </span>
            <span>
              <b>03</b> Your workspace opens
            </span>
          </div>
        </div>
        <p className="auth-bottom">
          An independent HackUTD prototype. Financial records and institution
          connections are simulated.
        </p>
      </main>
    </div>
  );
}
