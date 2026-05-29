"use client";

import type { Provider } from "@supabase/supabase-js";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type AuthRegion = "global" | "china";

const chinaAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_CHINA_AUTH === "true";

export default function LoginPage() {
  const router = useRouter();

  const [region, setRegion] = useState<AuthRegion>("global");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
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

  async function finishSession(accessToken: string) {
    const ensureResult = await ensureInviteCode(accessToken);

    if (!ensureResult.ok) {
      setStatus(
        `Logged in, but invite code setup needs attention: ${ensureResult.message}`
      );
    }

    const pendingInviteCode = getPendingInviteCode();

    if (pendingInviteCode) {
      const referralResult = await applyReferralCode(
        accessToken,
        pendingInviteCode
      );

      if (referralResult.applied) {
        setPendingInviteCode("");
      } else if (referralResult.message) {
        setStatus(`Logged in. Invite code notice: ${referralResult.message}`);
      }
    }
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
        await finishSession(data.session.access_token);
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

      await finishSession(session.access_token);

      if (normalizedInviteCode) {
        const referralResult = await applyReferralCode(
          session.access_token,
          normalizedInviteCode
        );

        if (referralResult.message) {
          setStatus(`Account created. ${referralResult.message}`);
        }
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

  async function handleOAuth(provider: Provider) {
    setStatus("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });

      if (error) {
        setStatus(
          `${provider} login is not available yet. Configure the provider in Supabase before production testing.`
        );
      }
    } catch (error) {
      console.error("OAUTH_ERROR:", error);
      setStatus(
        error instanceof Error
          ? `OAuth login failed: ${error.message}`
          : "OAuth login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSmsCode() {
    setStatus("");

    if (!phone.trim()) {
      setStatus("请输入手机号 / Please enter your phone number.");
      return;
    }

    if (!chinaAuthEnabled) {
      setSmsSent(true);
      setStatus(
        "本地测试已跳过短信服务商调用。正式部署前设置 NEXT_PUBLIC_ENABLE_CHINA_AUTH=true 并配置 Supabase Phone Auth / SMS provider 后再测试真实验证码。"
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
      });

      if (error) {
        setStatus(
          `短信验证码暂未完成环境配置：${error.message}. Configure Supabase Phone Auth and SMS provider before production testing.`
        );
        return;
      }

      setSmsSent(true);
      setStatus("验证码已发送 / Verification code sent.");
    } catch (error) {
      console.error("SMS_SEND_ERROR:", error);
      setStatus(
        error instanceof Error
          ? `SMS login failed: ${error.message}`
          : "SMS login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySmsCode() {
    setStatus("");

    if (!phone.trim() || !smsCode.trim()) {
      setStatus("请输入手机号和验证码 / Enter phone and code.");
      return;
    }

    if (!chinaAuthEnabled) {
      setStatus(
        "本地测试模式不会验证短信验证码。正式环境配置短信服务后，此按钮会调用 Supabase verifyOtp。"
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: smsCode.trim(),
        type: "sms",
      });

      if (error) {
        setStatus(
          `验证码验证失败：${error.message}. This path can be fully tested after SMS credentials are configured.`
        );
        return;
      }

      if (data.session?.access_token) {
        await finishSession(data.session.access_token);
      }

      router.push("/profile");
    } catch (error) {
      console.error("SMS_VERIFY_ERROR:", error);
      setStatus(
        error instanceof Error
          ? `SMS verification failed: ${error.message}`
          : "SMS verification failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleWechatLogin() {
    const configuredUrl = process.env.NEXT_PUBLIC_WECHAT_LOGIN_URL;

    if (configuredUrl) {
      window.location.href = configuredUrl;
      return;
    }

    setStatus(
      "微信扫码登录入口已预留。正式测试前需配置微信开放平台、回调地址和 NEXT_PUBLIC_WECHAT_LOGIN_URL。"
    );
  }

  function handleEmailSubmit() {
    if (mode === "login") {
      handleLogin();
      return;
    }

    handleSignup();
  }

  return (
    <main className="min-h-screen bg-[#090b0a] px-6 py-10 text-[#f8f4ea]">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-[#f8f4ea]/50">
          ← Back to Home
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-h-[560px] flex-col justify-between rounded-lg border border-[#f8f4ea]/10 bg-[#12130f] p-7">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-[#c9a64d]/35 bg-[#c9a64d]/10 px-4 py-2 text-sm text-[#f1d691]">
                SoulLoop Account
              </p>

              <h1 className="text-5xl font-semibold leading-tight">
                Choose your login region.
              </h1>

              <p className="mt-5 max-w-md leading-8 text-[#f8f4ea]/58">
                Global keeps Google, GitHub, and email. China keeps WeChat scan
                and SMS code paths ready for production credentials.
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              {[
                ["global", "Global", "Google, GitHub, email"],
                ["china", "China", "WeChat scan, SMS code"],
              ].map(([id, title, text]) => {
                const active = region === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setRegion(id as AuthRegion);
                      setStatus("");
                    }}
                    className={`rounded-lg border p-5 text-left transition ${
                      active
                        ? "border-[#f1d691]/60 bg-[#f1d691]/12"
                        : "border-[#f8f4ea]/10 bg-[#f8f4ea]/5 hover:bg-[#f8f4ea]/8"
                    }`}
                  >
                    <span className="block text-xl font-semibold">{title}</span>
                    <span className="mt-2 block text-sm text-[#f8f4ea]/50">
                      {text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/6 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
            {region === "global" ? (
              <div>
                <div className="flex rounded-full border border-[#f8f4ea]/10 bg-black/20 p-1">
                  {[
                    ["login", "Log in"],
                    ["signup", "Sign up"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setMode(id as AuthMode);
                        setStatus("");
                        setConfirmPassword("");
                      }}
                      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                        mode === id
                          ? "bg-[#f8f4ea] text-[#11100d]"
                          : "text-[#f8f4ea]/55 hover:text-[#f8f4ea]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    disabled={loading}
                    className="rounded-full border border-[#f8f4ea]/12 bg-[#f8f4ea] px-5 py-3 font-semibold text-[#11100d] disabled:opacity-50"
                  >
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth("github")}
                    disabled={loading}
                    className="rounded-full border border-[#f8f4ea]/12 bg-[#16130d] px-5 py-3 font-semibold text-[#f8f4ea] disabled:opacity-50"
                  >
                    Continue with GitHub
                  </button>
                </div>

                <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[#f8f4ea]/35">
                  <span className="h-px flex-1 bg-[#f8f4ea]/10" />
                  Email
                  <span className="h-px flex-1 bg-[#f8f4ea]/10" />
                </div>

                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setStatus("");
                    }}
                    className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#0c0d0a] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/30"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setStatus("");
                    }}
                    className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#0c0d0a] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/30"
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
                      className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#0c0d0a] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/30"
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
                        className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#0c0d0a] p-4 uppercase tracking-[0.12em] text-[#f8f4ea] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#f8f4ea]/30"
                      />
                      <p className="mt-2 text-xs leading-5 text-[#f8f4ea]/35">
                        Rewards bind after the invited user completes a paid
                        purchase.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleEmailSubmit}
                    disabled={
                      loading ||
                      !email ||
                      !password ||
                      (mode === "signup" &&
                        (!confirmPassword || password !== confirmPassword))
                    }
                    className="w-full rounded-full bg-[#f8f4ea] px-8 py-4 font-semibold text-[#11100d] disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="mt-6 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setStatus("");
                    }}
                    className="text-[#f8f4ea]/60 underline"
                  >
                    {mode === "login"
                      ? "Create an account"
                      : "Already have an account?"}
                  </button>

                  <Link
                    href="/forgot-password"
                    className="text-[#f8f4ea]/60 underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                  <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#0c0d0a] p-5">
                    <div className="mx-auto grid h-48 w-48 place-items-center rounded-lg border border-[#f8f4ea]/14 bg-[#f8f4ea] text-center text-sm font-semibold text-[#11100d]">
                      WeChat QR
                      <span className="mt-1 block text-xs font-normal text-[#11100d]/55">
                        Configure before launch
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleWechatLogin}
                      className="mt-5 w-full rounded-full bg-[#f8f4ea] px-5 py-3 font-semibold text-[#11100d]"
                    >
                      微信扫码登录
                    </button>
                  </div>

                  <div className="rounded-lg border border-[#f8f4ea]/10 bg-[#0c0d0a] p-5">
                    <h2 className="text-2xl font-semibold">短信验证码登录</h2>
                    <p className="mt-3 text-sm leading-6 text-[#f8f4ea]/50">
                      Local UI is ready. Full SMS delivery depends on Supabase
                      Phone Auth and an SMS provider in production.
                    </p>

                    <div className="mt-5 space-y-4">
                      <input
                        type="tel"
                        placeholder="+86 138 0000 0000"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          setStatus("");
                        }}
                        className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#12130f] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/30"
                      />

                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="验证码 / Code"
                          value={smsCode}
                          onChange={(event) => {
                            setSmsCode(event.target.value);
                            setStatus("");
                          }}
                          className="w-full rounded-2xl border border-[#f8f4ea]/10 bg-[#12130f] p-4 text-[#f8f4ea] outline-none placeholder:text-[#f8f4ea]/30"
                        />

                        <button
                          type="button"
                          onClick={handleSendSmsCode}
                          disabled={loading}
                          className="rounded-full border border-[#f8f4ea]/18 px-5 py-3 font-semibold text-[#f8f4ea] disabled:opacity-50"
                        >
                          {smsSent ? "Resend" : "Send"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifySmsCode}
                        disabled={loading || !phone || !smsCode}
                        className="w-full rounded-full bg-[#f8f4ea] px-8 py-4 font-semibold text-[#11100d] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        登录 / Verify and log in
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-5 rounded-lg border border-[#f1d691]/20 bg-[#f1d691]/10 p-4 text-sm leading-6 text-[#f8f4ea]/70">
                  China login paths are intentionally allowed to fail in local
                  tests until WeChat and SMS credentials are installed.
                </p>
              </div>
            )}

            {status && (
              <div className="mt-5 rounded-2xl border border-[#f8f4ea]/10 bg-black/20 p-4 text-sm leading-6 text-[#f8f4ea]/70">
                {status}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
