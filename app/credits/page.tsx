"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
  active: boolean;
  created_at: string;
};

type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  reason: string | null;
  message_id: string | null;
  stripe_session_id: string | null;
  paypal_order_id: string | null;
  alipay_out_trade_no: string | null;
  created_at: string;
};

type ProfileRow = {
  credits_balance: number;
  email: string | null;
};

const STANDARD_READING_COST = 8;

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: (currency || "cny").toUpperCase(),
  }).format(priceCents / 100);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getTransactionLabel(type: string) {
  const map: Record<string, string> = {
    grant: "Bonus",
    usage: "Reading Usage",
    purchase: "Purchase",
    refund: "Refund",
    admin_adjust: "Adjustment",
  };

  return map[type] || type;
}

export default function CreditsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCreditsPage() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setLoading(false);
          return;
        }

        if (!session?.user) {
          router.push("/login");
          return;
        }

        const [profileResult, packagesResult, transactionsResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("email,credits_balance")
              .eq("id", session.user.id)
              .single(),

            supabase
              .from("credit_packages")
              .select(
                "id,name,credits,price_cents,currency,stripe_price_id,active,created_at"
              )
              .eq("active", true)
              .order("price_cents", { ascending: true }),

            supabase
              .from("credit_transactions")
              .select(
                "id,amount,type,reason,message_id,stripe_session_id,paypal_order_id,alipay_out_trade_no,created_at"
              )
              .order("created_at", { ascending: false })
              .limit(50),
          ]);

        if (profileResult.error) {
          setError(`Profile load error: ${profileResult.error.message}`);
          setLoading(false);
          return;
        }

        if (packagesResult.error) {
          setError(`Packages load error: ${packagesResult.error.message}`);
          setLoading(false);
          return;
        }

        if (transactionsResult.error) {
          setError(
            `Transactions load error: ${transactionsResult.error.message}`
          );
          setLoading(false);
          return;
        }

        setProfile(profileResult.data as ProfileRow);
        setPackages((packagesResult.data || []) as CreditPackage[]);
        setTransactions(
          (transactionsResult.data || []) as CreditTransaction[]
        );

        setLoading(false);
      } catch (error) {
        console.error("LOAD_CREDITS_PAGE_ERROR:", error);

        setError(
          error instanceof Error
            ? `Failed to load credits page: ${error.message}`
            : "Failed to load credits page."
        );

        setLoading(false);
      }
    }

    loadCreditsPage();
  }, [router]);

  const readingsLeft = useMemo(() => {
    if (!profile) return 0;
    return Math.floor(profile.credits_balance / STANDARD_READING_COST);
  }, [profile]);

  const needsTopUp = useMemo(() => {
    if (!profile) return false;
    return profile.credits_balance < STANDARD_READING_COST;
  }, [profile]);

  async function handleCheckout(packageId: string) {
    setError("");
    setCheckoutLoadingId(packageId);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError("Please log in before buying credits.");
        setCheckoutLoadingId(null);
        return;
      }

      const response = await fetch("/api/alipay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          packageId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create Alipay order.");
        setCheckoutLoadingId(null);
        return;
      }

      if (!data.formHtml) {
        setError("Alipay payment form was not returned.");
        setCheckoutLoadingId(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.style.display = "none";
      wrapper.innerHTML = data.formHtml;
      document.body.appendChild(wrapper);

      const form = wrapper.querySelector("form") as HTMLFormElement | null;

      if (!form) {
        setError("Alipay payment form was invalid.");
        setCheckoutLoadingId(null);
        document.body.removeChild(wrapper);
        return;
      }

      form.submit();
    } catch (error) {
      console.error("ALIPAY_CHECKOUT_ERROR:", error);

      setError(
        error instanceof Error
          ? `Alipay checkout failed: ${error.message}`
          : "Alipay checkout failed."
      );

      setCheckoutLoadingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Loading your credits...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm text-white/50">
            ← Back to Home
          </Link>

          <div className="flex gap-4 text-sm">
            <Link href="/chat" className="text-white/60 underline">
              Ask SoulLoop
            </Link>
            <Link href="/history" className="text-white/60 underline">
              History
            </Link>
            <Link href="/profile" className="text-white/60 underline">
              Profile
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
              SoulLoop Credits
            </p>

            <h1 className="text-5xl font-bold md:text-6xl">
              Balance & Usage
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-white/60">
              Credits power SoulLoop Reading Reports. Each standard reading
              currently costs {STANDARD_READING_COST} credits.
            </p>

            <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Current Balance
              </p>

              <div className="mt-4 flex items-end gap-3">
                <span className="text-6xl font-bold text-white">
                  {profile?.credits_balance ?? "—"}
                </span>
                <span className="pb-2 text-lg text-white/50">credits</span>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-white/40">Available readings</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {readingsLeft}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Based on {STANDARD_READING_COST} credits per standard reading.
                </p>
              </div>

              {needsTopUp ? (
                <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                  <p className="font-semibold text-amber-100">
                    You do not have enough credits for a standard reading.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Choose a credit package to continue generating SoulLoop
                    Reading Reports.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                  <p className="font-semibold text-emerald-100">
                    You have enough credits to continue.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    You can generate approximately {readingsLeft} more standard
                    reading{readingsLeft === 1 ? "" : "s"}.
                  </p>
                </div>
              )}

              <p className="mt-4 text-sm leading-6 text-white/45">
                Signed in as{" "}
                <span className="text-white/70">{profile?.email}</span>
              </p>
            </div>
          </div>

          <div>
            {error && (
              <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                    Credit Packages
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Choose a package
                  </h2>
                </div>

                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                  Alipay Sandbox
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {packages.map((item) => {
                  const packageReadings = Math.floor(
                    item.credits / STANDARD_READING_COST
                  );

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <h3 className="text-xl font-semibold">{item.name}</h3>

                      <div className="mt-4">
                        <p className="text-4xl font-bold">{item.credits}</p>
                        <p className="mt-1 text-sm text-white/45">credits</p>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-white/55">
                        About {packageReadings} standard reading reports
                      </p>

                      <p className="mt-4 text-lg font-semibold">
                        {formatPrice(item.price_cents, item.currency || "cny")}
                      </p>

                      <button
                        onClick={() => handleCheckout(item.id)}
                        disabled={checkoutLoadingId !== null}
                        className="mt-5 w-full rounded-full bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkoutLoadingId === item.id
                          ? "Opening Alipay..."
                          : "Buy with Alipay"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="mt-5 text-sm leading-6 text-white/45">
                Payments are processed through Alipay Sandbox. Credits are added
                after Alipay sends a verified payment notification.
              </p>
            </div>

            <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Credit Transactions
              </p>

              <h2 className="mt-2 text-2xl font-bold">Recent activity</h2>

              {transactions.length === 0 ? (
                <p className="mt-5 text-white/55">
                  No credit transactions yet.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {transactions.map((item) => {
                    const positive = item.amount > 0;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {getTransactionLabel(item.type)}
                          </p>

                          <p className="mt-1 text-sm text-white/45">
                            {item.reason || "No reason"} ·{" "}
                            {formatDate(item.created_at)}
                          </p>

                          {item.message_id && (
                            <p className="mt-1 text-xs text-white/30">
                              Message ID: {item.message_id}
                            </p>
                          )}

                          {item.alipay_out_trade_no && (
                            <p className="mt-1 text-xs text-white/30">
                              Alipay Order: {item.alipay_out_trade_no}
                            </p>
                          )}
                        </div>

                        <div
                          className={`text-xl font-bold ${
                            positive ? "text-emerald-300" : "text-red-200"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {item.amount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}