"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      setCheckingSession(true);
      setStatus("");

      try {
        const code = searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            setStatus(`Recovery link error: ${error.message}`);
            setSessionReady(false);
            setCheckingSession(false);
            return;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setStatus(`Session error: ${sessionError.message}`);
          setSessionReady(false);
          setCheckingSession(false);
          return;
        }

        if (!session) {
          setStatus(
            "Your password reset session is missing or expired. Please request a new reset link."
          );
          setSessionReady(false);
          setCheckingSession(false);
          return;
        }

        setSessionReady(true);
        setCheckingSession(false);
      } catch (error) {
        console.error("RESET_PASSWORD_SESSION_ERROR:", error);

        setStatus(
          error instanceof Error
            ? `Failed to prepare reset session: ${error.message}`
            : "Failed to prepare reset session."
        );

        setSessionReady(false);
        setCheckingSession(false);
      }
    }

    prepareRecoverySession();
  }, [searchParams]);

  async function handleUpdatePassword() {
    setStatus("");

    if (!sessionReady) {
      setStatus("Password reset session is not ready.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Password updated successfully. Redirecting to login...");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (error) {
      console.error("UPDATE_PASSWORD_ERROR:", error);

      setStatus(
        error instanceof Error
          ? `Failed to update password: ${error.message}`
          : "Failed to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-md">
        <Link href="/login" className="text-sm text-white/50">
          ← Back to Login
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            Password Reset
          </p>

          <h1 className="text-4xl font-bold">Create new password</h1>

          <p className="mt-4 leading-7 text-white/60">
            Set a new password for your SoulLoop account.
          </p>

          {checkingSession ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Checking your reset link...
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setStatus("");
                }}
                disabled={!sessionReady}
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setStatus("");
                }}
                disabled={!sessionReady}
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />

              <button
                onClick={handleUpdatePassword}
                disabled={
                  loading || !sessionReady || !password || !confirmPassword
                }
                className="w-full rounded-full bg-white px-8 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </div>
          )}

          {status && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
              {status}
            </div>
          )}

          {!sessionReady && !checkingSession && (
            <Link
              href="/forgot-password"
              className="mt-6 inline-block text-sm text-white/60 underline"
            >
              Request a new reset link
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-md">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="text-white/60">Loading password reset page...</p>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}