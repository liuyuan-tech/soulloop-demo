"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    setStatus("");

    if (!email) {
      setStatus("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus(
        "Password reset email sent. Please check your inbox and follow the link."
      );
    } catch (error) {
      console.error("RESET_PASSWORD_EMAIL_ERROR:", error);

      setStatus(
        error instanceof Error
          ? `Failed to send reset email: ${error.message}`
          : "Failed to send reset email."
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
            Account Recovery
          </p>

          <h1 className="text-4xl font-bold">Reset password</h1>

          <p className="mt-4 leading-7 text-white/60">
            Enter your account email. SoulLoop will send you a password reset
            link.
          </p>

          <div className="mt-8 space-y-4">
            <input
              type="email"
              placeholder="Your account email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setStatus("");
              }}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
            />

            <button
              onClick={handleResetPassword}
              disabled={loading || !email}
              className="w-full rounded-full bg-white px-8 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </div>

          {status && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
              {status}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}