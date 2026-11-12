"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthFormState } from "./actions";

type Props = {
  mode: "login" | "signup";
  googleEnabled: boolean;
};

export function AuthForm({ mode, googleEnabled }: Props) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    undefined,
  );

  return (
    <div className="panel w-full max-w-md p-8">
      <div className="mb-7 flex items-center gap-2.5">
        <span className="status-dot bg-signal pulse-slow" />
        <span className="label text-bone-2">Affiliate Autopilot</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-bone-3">
        {mode === "login"
          ? "Apna workspace kholo aur autopilot chalu karo."
          : "Free plan — 2 trial videos, no card needed."}
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="label mb-2 block text-bone-3">
              Name
            </label>
            <input
              id="name"
              name="name"
              className="field"
              placeholder="Rohit Sharma"
              autoComplete="name"
            />
            {state?.errors?.name && (
              <p className="mt-1.5 text-xs text-danger">
                {state.errors.name[0]}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label mb-2 block text-bone-3">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {state?.errors?.email && (
            <p className="mt-1.5 text-xs text-danger">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label mb-2 block text-bone-3">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            placeholder={mode === "signup" ? "8+ characters" : "••••••••"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {state?.errors?.password && (
            <p className="mt-1.5 text-xs text-danger">
              {state.errors.password[0]}
            </p>
          )}
        </div>

        {state?.message && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-signal w-full py-3">
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Log in →"
              : "Create account →"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-4" />
            <span className="label text-bone-3">or</span>
            <span className="h-px flex-1 bg-ink-4" />
          </div>
          <button
            type="button"
            onClick={() => {
              // OAuth ke liye full-page reload zaroori hai (Google redirect)
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/api/auth/signin/google";
            }}
            className="btn-ghost w-full py-3"
          >
            Continue with Google
          </button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-bone-3">
        {mode === "login" ? (
          <>
            Naya account?{" "}
            <Link href="/signup" className="text-signal hover:underline">
              Sign up free
            </Link>
          </>
        ) : (
          <>
            Account hai?{" "}
            <Link href="/login" className="text-signal hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
