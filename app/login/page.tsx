"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  function normalizeInviteCode(value: string) {
    return value.trim().toUpperCase();
  }

  function getPendingInviteCode() {
    if (typeof window === "undefined") return "";
    return normalizeInviteCode(
      window.localStorage.getItem("soulloop:pendingInviteCode") || ""
    );
  }

  function setPendingInviteCode(value: string) {
    if (typeof window === "undefined") return;

    const normalizedCode = normalizeInviteCode(value);

    if (normalizedCode) {
      window.localStorage.setItem("soulloop:pendingInviteCode", normalizedCode);
      return;
    }

    window.localStorage.removeItem("soulloop:pendingInviteCode");
  }

  async function ensureInviteCode(accessToken: string) {
    const response = await fetch("/api/referrals/ensure-invite-code", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        message: data.error || "Invite code could not be ensured.",
      };
    }

    return {
      ok: true,
      message: data.inviteCode
        ? `Invite code ready: ${data.inviteCode}`
        : "Invite code ready.",
    };
  }

  async function applyReferralCode(accessToken: string, code: string) {
    const normalizedCode = normalizeInviteCode(code);

    if (!normalizedCode) {
      return {
        applied: false,
        message: "",
      };
    }

    const response = await fetch("/api/referrals/apply-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        inviteCode: normalizedCode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        applied: false,
        message: data.error || "Invite code could not be applied.",
      };
    }

    return {
      applied: Boolean(data.applied),
      message: data.applied
        ? "Invite code applied successfully."
        : data.reason || "",
    };
  }

  async function handleLogin() {
    setStatus("");

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      if (data.session?.access_token) {
        const ensureResult = await ensureInviteCode(data.session.access_token);

        if (!ensureResult.ok) {
          setStatus(
            `Logged in, but invite code setup needs attention: ${ensureResult.message}`
          );
        }

        const pendingInviteCode = getPendingInviteCode();

        if (pendingInviteCode) {
          const referralResult = await applyReferralCode(
            data.session.access_token,
            pendingInviteCode
          );

          if (referralResult.applied) {
            setPendingInviteCode("");
          } else if (referralResult.message) {
            setStatus(`Logged in. Invite code notice: ${referralResult.message}`);
          }
        }
      }

      router.push("/profile");
    } catch (error) {
      console.error("LOGIN_ERROR:", error);

      setStatus(
        error instanceof Error ? `Login failed: ${error.message}` : "Login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setStatus("");

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    if (!confirmPassword) {
      setStatus("Please enter your password again to confirm.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match. 两次输入的密码不一致。");
      return;
    }

    setLoading(true);

    try {
      const normalizedInviteCode = normalizeInviteCode(inviteCode);
      const emailRedirectTo = `${window.location.origin}/login`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            referral_code: normalizedInviteCode || null,
          },
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const session = data.session;

      if (!session?.access_token) {
        if (normalizedInviteCode) {
          setPendingInviteCode(normalizedInviteCode);
        }

        router.push(
          `/signup-check-email?email=${encodeURIComponent(email.trim())}`
        );
        return;
      }

      const ensureResult = await ensureInviteCode(session.access_token);

      let referralMessage = "";

      if (normalizedInviteCode) {
        const referralResult = await applyReferralCode(
          session.access_token,
          normalizedInviteCode
        );

        referralMessage = referralResult.message;
      }

      if (!ensureResult.ok) {
        setStatus(
          referralMessage
            ? `Account created. ${referralMessage} Invite code setup needs attention: ${ensureResult.message}`
            : `Account created. Invite code setup needs attention: ${ensureResult.message}`
        );
      } else {
        setStatus(
          referralMessage
            ? `Account created. ${referralMessage}`
            : "Account created successfully."
        );
      }

      router.push("/profile");
    } catch (error) {
      console.error("SIGNUP_ERROR:", error);

      setStatus(
        error instanceof Error
          ? `Signup failed: ${error.message}`
          : "Signup failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (mode === "login") {
      handleLogin();
      return;
    }

    handleSignup();
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
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-4 leading-7 text-white/60">
            {mode === "login"
              ? "Log in to continue your SoulLoop readings."
              : "Sign up to save your profile, readings, credits, and referral rewards."}
          </p>

          <div className="mt-8 flex rounded-full border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => {
                setMode("login");
                setStatus("");
                setConfirmPassword("");
              }}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                mode === "login"
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              Log in
            </button>

            <button
              onClick={() => {
                setMode("signup");
                setStatus("");
              }}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                mode === "signup"
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setStatus("");
              }}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setStatus("");
              }}
              className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
            />

            {mode === "signup" && (
              <input
                type="password"
                placeholder="Confirm password / 再次输入密码"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setStatus("");
                }}
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
              />
            )}

            {mode === "signup" && password && confirmPassword && (
              <p
                className={`text-sm ${
                  password === confirmPassword
                    ? "text-emerald-200/80"
                    : "text-red-200/80"
                }`}
              >
                {password === confirmPassword
                  ? "Passwords match. 两次密码一致。"
                  : "Passwords do not match. 两次输入的密码不一致。"}
              </p>
            )}

            {mode === "signup" && (
              <div>
                <input
                  type="text"
                  placeholder="Invite code optional"
                  value={inviteCode}
                  onChange={(event) => {
                    setInviteCode(normalizeInviteCode(event.target.value));
                    setStatus("");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 uppercase tracking-[0.12em] text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30"
                />

                <p className="mt-2 text-xs leading-5 text-white/35">
                  Have an invite code? Enter it here to bind your account to the
                  referrer. Rewards are created after your paid purchase.
                </p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                loading ||
                !email ||
                !password ||
                (mode === "signup" &&
                  (!confirmPassword || password !== confirmPassword))
              }
              className="w-full rounded-full bg-white px-8 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
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

          {mode === "login" && (
            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                onClick={() => {
                  setMode("signup");
                  setStatus("");
                }}
                className="text-white/60 underline"
              >
                Create an account
              </button>

              <Link href="/forgot-password" className="text-white/60 underline">
                Forgot password?
              </Link>
            </div>
          )}

          {mode === "signup" && (
            <div className="mt-6 text-sm">
              <button
                onClick={() => {
                  setMode("login");
                  setStatus("");
                  setConfirmPassword("");
                }}
                className="text-white/60 underline"
              >
                Already have an account? Log in
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
