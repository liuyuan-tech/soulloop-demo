"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Provider = "alipay" | "stripe";
type ConfirmStatus = "checking" | "completed" | "pending" | "failed";

type ConfirmPaymentResponse = {
  status?: ConfirmStatus;
  paymentStatus?: string | null;
  provider?: string | null;
  paymentId?: string;
  outTradeNo?: string | null;
  sessionId?: string | null;
  credits_granted?: number;
  amount_total?: number;
  currency?: string;
  alipay_trade_no?: string | null;
  stripe_payment_intent_id?: string | null;
  provider_order_id?: string | null;
  completed_at?: string | null;
  error?: string;
};

const MAX_CONFIRM_ATTEMPTS = 6;
const CONFIRM_RETRY_DELAY_MS = 3000;

function normalizeProvider(value: string | null): Provider {
  return value === "stripe" ? "stripe" : "alipay";
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: (currency || "cny").toUpperCase(),
  }).format(priceCents / 100);
}

function getStatusCopy(status: ConfirmStatus) {
  const copy: Record<ConfirmStatus, { label: string; title: string }> = {
    checking: {
      label: "Checking Payment",
      title: "Confirming your payment",
    },
    completed: {
      label: "Payment Completed",
      title: "Credits added successfully",
    },
    pending: {
      label: "Confirming Payment",
      title: "Confirming payment",
    },
    failed: {
      label: "Needs Attention",
      title: "Payment confirmation issue",
    },
  };

  return copy[status];
}

function getStatusClasses(status: ConfirmStatus) {
  const classes: Record<ConfirmStatus, string> = {
    checking: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    completed: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    pending: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    failed: "border-red-300/20 bg-red-300/10 text-red-100",
  };

  return classes[status];
}

function getStoredAlipayOutTradeNo() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("soulloop:lastAlipayOutTradeNo");
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();

  const provider = normalizeProvider(searchParams.get("provider"));
  const queryOutTradeNo = searchParams.get("out_trade_no");
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<ConfirmStatus>("checking");
  const [message, setMessage] = useState("Checking SoulLoop payment status...");
  const [result, setResult] = useState<ConfirmPaymentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function confirmPayment(attempt: number) {
      const effectiveOutTradeNo =
        queryOutTradeNo || getStoredAlipayOutTradeNo();

      if (provider === "alipay" && !effectiveOutTradeNo) {
        setStatus("failed");
        setMessage("Missing Alipay order number. Please return to Credits.");
        return;
      }

      if (provider === "stripe" && !sessionId) {
        setStatus("failed");
        setMessage("Missing Stripe Checkout Session ID. Please return to Credits.");
        return;
      }

      if (attempt === 1) {
        setStatus("checking");
        setMessage("Checking SoulLoop payment status...");
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError || !session?.access_token) {
          setStatus("failed");
          setMessage("Please log in again to confirm this payment.");
          return;
        }

        const endpoint =
          provider === "stripe"
            ? "/api/stripe/confirm-session"
            : "/api/alipay/confirm-order";
        const body =
          provider === "stripe"
            ? { sessionId }
            : { outTradeNo: effectiveOutTradeNo };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });

        const data = (await response
          .json()
          .catch(() => ({}))) as ConfirmPaymentResponse;

        if (cancelled) return;

        if (!response.ok) {
          setResult(data);
          setStatus("failed");
          setMessage(data.error || "Could not confirm this payment.");
          return;
        }

        setResult(data);

        if (data.status === "completed") {
          setStatus("completed");
          setMessage("Your SoulLoop credits have been added.");
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setMessage("This payment is not marked as successful.");
          return;
        }

        setStatus("pending");

        if (attempt < MAX_CONFIRM_ATTEMPTS) {
          setMessage("Payment received, confirming credits...");
          timeoutId = setTimeout(
            () => confirmPayment(attempt + 1),
            CONFIRM_RETRY_DELAY_MS
          );
          return;
        }

        setMessage(
          "Payment received, but SoulLoop is still waiting for verified confirmation."
        );
      } catch (error) {
        if (cancelled) return;

        console.error("PAYMENT_SUCCESS_CONFIRM_ERROR:", error);

        setStatus("failed");
        setMessage(
          error instanceof Error
            ? `Payment confirmation failed: ${error.message}`
            : "Payment confirmation failed."
        );
      }
    }

    confirmPayment(1);

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [provider, queryOutTradeNo, sessionId]);

  const statusCopy = useMemo(() => getStatusCopy(status), [status]);
  const statusClasses = useMemo(() => getStatusClasses(status), [status]);
  const amountTotal = result?.amount_total ?? 0;
  const currency = result?.currency || (provider === "stripe" ? "usd" : "cny");
  const creditsGranted = result?.credits_granted ?? 0;
  const providerLabel = provider === "stripe" ? "Stripe" : "Alipay";
  const providerReference =
    provider === "stripe"
      ? result?.stripe_payment_intent_id || result?.sessionId || sessionId
      : result?.alipay_trade_no || result?.outTradeNo || queryOutTradeNo;

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-white/50">
          Back to Home
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p
            className={`mb-4 inline-block rounded-full border px-4 py-2 text-sm ${statusClasses}`}
          >
            {statusCopy.label}
          </p>

          <h1 className="text-4xl font-bold md:text-5xl">
            {statusCopy.title}
          </h1>

          <p className="mt-5 text-lg leading-8 text-white/70">{message}</p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-white/40">{providerLabel} Reference</p>
            <p className="mt-2 break-all text-sm text-white/75">
              {providerReference || "Unavailable"}
            </p>
          </div>

          {status === "completed" && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Credits Added</p>
                <p className="mt-2 text-2xl font-bold text-emerald-200">
                  +{creditsGranted}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Amount</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatPrice(amountTotal, currency)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Provider</p>
                <p className="mt-2 text-2xl font-bold">{providerLabel}</p>
              </div>
            </div>
          )}

          {status === "pending" && (
            <p className="mt-5 text-sm leading-6 text-white/55">
              You can return to Credits now. When the verified payment
              confirmation arrives, the credits page will show the updated
              balance.
            </p>
          )}

          {status === "failed" && (
            <p className="mt-5 text-sm leading-6 text-white/55">
              No credits were added by this confirmation page. Please check the
              Credits page and retry from the current checkout flow if the order
              still appears pending.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/credits"
              className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
            >
              Back to Credits
            </Link>

            {status === "completed" && (
              <Link
                href="/chat"
                className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
              >
                Ask SoulLoop
              </Link>
            )}
          </div>

          <p className="mt-5 text-xs text-white/35">
            Provider: {providerLabel} | Local status:{" "}
            {result?.paymentStatus || "checking"}
          </p>
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
