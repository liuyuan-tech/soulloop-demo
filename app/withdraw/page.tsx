"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type RewardRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  available_at: string | null;
};

type WithdrawalRow = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payout_method: string;
  created_at: string;
};

const ACTIVE_WITHDRAWAL_STATUSES = ["pending", "approved"];

function formatMoney(amountCents: number, currency = "cny") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function sumAmount(rows: Array<{ amount_cents: number | null }>) {
  return rows.reduce((total, row) => {
    return total + (typeof row.amount_cents === "number" ? row.amount_cents : 0);
  }, 0);
}

function isWithdrawableReward(reward: RewardRow) {
  return (
    reward.status === "available" ||
    (reward.status === "pending" &&
      Boolean(reward.available_at) &&
      new Date(reward.available_at as string).getTime() <= Date.now())
  );
}

export default function WithdrawPage() {
  const router = useRouter();

  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"alipay" | "paypal" | "bank">(
    "alipay"
  );
  const [accountDetails, setAccountDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadWithdrawPage = useCallback(async function loadWithdrawPage() {
    setLoading(true);
    setError("");

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

    const [rewardsResult, withdrawalsResult] = await Promise.all([
      supabase
        .from("referral_rewards")
        .select("id,amount_cents,currency,status,available_at")
        .eq("referrer_user_id", session.user.id),
      supabase
        .from("withdrawal_requests")
        .select("id,amount_cents,currency,status,payout_method,created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (rewardsResult.error) {
      setError(`Rewards load error: ${rewardsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (withdrawalsResult.error) {
      setError(`Withdrawals load error: ${withdrawalsResult.error.message}`);
      setLoading(false);
      return;
    }

    setRewards((rewardsResult.data || []) as RewardRow[]);
    setWithdrawals((withdrawalsResult.data || []) as WithdrawalRow[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(loadWithdrawPage);
  }, [loadWithdrawPage]);

  const availableCents = useMemo(() => {
    return sumAmount(rewards.filter(isWithdrawableReward));
  }, [rewards]);

  const activeWithdrawalCents = useMemo(() => {
    return sumAmount(
      withdrawals.filter((withdrawal) =>
        ACTIVE_WITHDRAWAL_STATUSES.includes(withdrawal.status)
      )
    );
  }, [withdrawals]);

  const withdrawableCents = Math.max(0, availableCents - activeWithdrawalCents);
  const amountCents = Math.round(Number(amount || 0) * 100);

  async function handleSubmit() {
    setError("");
    setMessage("");

    if (!amountCents || amountCents <= 0) {
      setError("Enter a withdrawal amount greater than zero.");
      return;
    }

    if (amountCents > withdrawableCents) {
      setError("Amount exceeds available withdrawal balance.");
      return;
    }

    if (!accountDetails.trim()) {
      setError("Enter payout account details.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please log in again before submitting.");
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/withdrawals/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amountCents,
          payoutMethod,
          accountDetails,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Withdrawal request failed.");
        setSubmitting(false);
        return;
      }

      setAmount("");
      setAccountDetails("");
      setMessage("Withdrawal request submitted for manual review.");
      await loadWithdrawPage();
    } catch (error) {
      setError(
        error instanceof Error
          ? `Withdrawal request failed: ${error.message}`
          : "Withdrawal request failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Loading withdrawal balance...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/referrals" className="text-sm text-white/50">
            Back to Referrals
          </Link>

          <Link href="/credits" className="text-sm text-white/60 underline">
            Credits
          </Link>
        </div>

        <div className="mt-10">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            Manual Withdrawal
          </p>

          <h1 className="text-5xl font-bold md:text-6xl">
            Request payout review
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Available referral rewards can be submitted for manual payout
            review. Pending rewards are not withdrawable.
          </p>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
            {message}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-white/35">
              Withdrawable
            </p>
            <p className="mt-4 text-5xl font-bold">
              {formatMoney(withdrawableCents)}
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/55">
              <p>Available rewards: {formatMoney(availableCents)}</p>
              <p>Pending review: {formatMoney(activeWithdrawalCents)}</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-white/35">
              Payout Details
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Amount"
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
              />

              <select
                value={payoutMethod}
                onChange={(event) =>
                  setPayoutMethod(event.target.value as "alipay" | "paypal" | "bank")
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none"
              >
                <option value="alipay">Alipay</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank</option>
              </select>

              <textarea
                value={accountDetails}
                onChange={(event) => setAccountDetails(event.target.value)}
                placeholder="Account details for manual review"
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-[#111122] p-4 text-white outline-none placeholder:text-white/30"
              />

              <button
                onClick={handleSubmit}
                disabled={submitting || withdrawableCents <= 0}
                className="w-full rounded-full bg-white px-8 py-4 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Withdrawal Request"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-white/35">
            Recent Requests
          </p>

          {withdrawals.length === 0 ? (
            <p className="mt-5 text-white/55">No withdrawal requests yet.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {formatMoney(withdrawal.amount_cents, withdrawal.currency)}
                    </p>
                    <p className="mt-1 text-sm text-white/45">
                      {withdrawal.payout_method} · {withdrawal.status}
                    </p>
                  </div>
                  <p className="text-xs text-white/35">
                    {new Date(withdrawal.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
