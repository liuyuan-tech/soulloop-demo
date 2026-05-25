"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignupCheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-10">
          <p className="mb-4 inline-block rounded-full border border-emerald-200/20 bg-emerald-200/10 px-4 py-2 text-sm text-emerald-100">
            Email Confirmation Required / 需要邮箱确认
          </p>

          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Please check your registration email
          </h1>

          <h2 className="mt-3 text-3xl font-semibold leading-tight text-white/90">
            请返回注册邮箱完成确认
          </h2>

          <p className="mt-6 text-lg leading-8 text-white/65">
            SoulLoop has sent a confirmation link to your registration email.
            Open that email and click the confirmation link before logging in.
          </p>

          <p className="mt-3 text-lg leading-8 text-white/65">
            SoulLoop 已向你的注册邮箱发送确认链接。请打开该邮件并点击确认链接，
            完成邮箱验证后再返回登录。
          </p>

          {email && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                Registration Email / 注册邮箱
              </p>
              <p className="mt-2 break-all text-lg font-semibold text-white">
                {email}
              </p>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-semibold">1. Check inbox</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                查看收件箱，寻找来自 SoulLoop / Supabase 的确认邮件。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-semibold">2. Confirm email</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                点击邮件里的确认链接，完成注册邮箱验证。
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-semibold">3. Log in</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                验证完成后，返回 SoulLoop 使用邮箱和密码登录。
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
            If you do not see the email, check spam or promotions folders. If
            the address is wrong, return to sign up and register again.
            <br />
            如果没有收到邮件，请检查垃圾邮件或推广邮件文件夹。如果邮箱填写错误，
            请返回注册页重新注册。
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
            >
              Go to Login / 前往登录
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
            >
              Use another email / 使用其他邮箱
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SignupCheckEmailFallback() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="text-white/60">
            Loading confirmation page... / 正在加载邮箱确认页面...
          </p>
        </div>
      </section>
    </main>
  );
}

export default function SignupCheckEmailPage() {
  return (
    <Suspense fallback={<SignupCheckEmailFallback />}>
      <SignupCheckEmailContent />
    </Suspense>
  );
}
