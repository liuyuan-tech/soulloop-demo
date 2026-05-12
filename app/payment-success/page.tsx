"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();

  const provider = searchParams.get("provider") || "alipay";
  const outTradeNo = searchParams.get("out_trade_no");

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-10 rounded-[32px] border border-emerald-300/20 bg-emerald-300/10 p-8">
          <p className="mb-4 inline-block rounded-full border border-emerald-300/20 px-4 py-2 text-sm text-emerald-100">
            Payment Submitted
          </p>

          <h1 className="text-5xl font-bold">Payment submitted</h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Your {provider} payment has been submitted. SoulLoop will add your
            credits after the verified payment notification is received.
          </p>

          {outTradeNo && (
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-white/40">SoulLoop Order</p>
              <p className="mt-2 break-all text-sm text-white/75">
                {outTradeNo}
              </p>
            </div>
          )}

          <p className="mt-5 text-sm leading-6 text-white/55">
            If your credits do not appear immediately, wait a few seconds and
            refresh the Credits page. Payment confirmation depends on the
            asynchronous Alipay notification.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/credits"
              className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
            >
              Check Credits
            </Link>

            <Link
              href="/chat"
              className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
            >
              Ask SoulLoop
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PaymentSuccessFallback() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="text-white/60">Loading payment result...</p>
        </div>
      </section>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}