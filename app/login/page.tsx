"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setStatus("");

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setStatus(error.message);
          return;
        }

        setStatus(
          "Account created. If email confirmation is enabled, please check your inbox. Then log in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatus(error.message);
          return;
        }

        router.push("/profile");
      }
    } catch (error) {
      console.error("AUTH_ERROR:", error);

      setStatus(
        error instanceof Error
          ? `Auth request failed: ${error.message}`
          : "Auth request failed. Please check your Supabase connection."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            SoulLoop Account
          </p>

          <h1 className="text-4xl font-bold">
            {mode === "login" ? "Log in" : "Create account"}
          </h1>

          <p className="mt-4 leading-7 text-white/60">
            Sign in to save your profile, credits, and SoulLoop reading history.
          </p>

          <div className="mt-8 space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
            />

            <input
              type="password"
              placeholder="Password, at least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
            />

            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-white/55 underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email || !password}
              className="w-full rounded-full bg-white px-8 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </button>
          </div>

          {status && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
              {status}
            </div>
          )}

          <button
            onClick={() => {
              setStatus("");
              setMode(mode === "login" ? "signup" : "login");
            }}
            className="mt-6 text-sm text-white/60 underline"
          >
            {mode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Log in"}
          </button>
        </div>
      </section>
    </main>
  );
}