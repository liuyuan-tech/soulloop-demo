"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  email: string | null;
  invite_code: string | null;
  referred_by_user_id: string | null;
};

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  invite_code: string;
  status: string;
  created_at: string;
};

type ReferralRewardRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  payment_id: string;
  amount_cents: number;
  currency: string;
  source_amount_cents: number;
  reward_rate_bps: number;
  status: string;
  available_at: string;
  created_at: string;
};

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: (currency || "cny").toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency || ""}`;
  }
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

function getRewardStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    available: "Available",
    paid: "Paid",
    cancelled: "Cancelled",
  };

  return map[status] || status;
}

function isRewardAvailable(item: ReferralRewardRow) {
  return (
    item.status === "available" ||
    (item.status === "pending" && new Date(item.available_at).getTime() <= Date.now())
  );
}

export default function ReferralsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReferralsPage() {
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

        const [profileResult, referralsResult, rewardsResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id,email,invite_code,referred_by_user_id")
              .eq("id", session.user.id)
              .single(),

            supabase
              .from("referrals")
              .select(
                "id,referrer_user_id,referred_user_id,invite_code,status,created_at"
              )
              .eq("referrer_user_id", session.user.id)
              .order("created_at", { ascending: false }),

            supabase
              .from("referral_rewards")
              .select(
                "id,referrer_user_id,referred_user_id,payment_id,amount_cents,currency,source_amount_cents,reward_rate_bps,status,available_at,created_at"
              )
              .eq("referrer_user_id", session.user.id)
              .order("created_at", { ascending: false }),
          ]);

        if (profileResult.error) {
          setError(`Profile load error: ${profileResult.error.message}`);
          setLoading(false);
          return;
        }

        if (referralsResult.error) {
          setError(`Referrals load error: ${referralsResult.error.message}`);
          setLoading(false);
          return;
        }

        if (rewardsResult.error) {
          setError(`Rewards load error: ${rewardsResult.error.message}`);
          setLoading(false);
          return;
        }

        setProfile(profileResult.data as ProfileRow);
        setReferrals((referralsResult.data || []) as ReferralRow[]);
        setRewards((rewardsResult.data || []) as ReferralRewardRow[]);

        setLoading(false);
      } catch (error) {
        console.error("LOAD_REFERRALS_PAGE_ERROR:", error);

        setError(
          error instanceof Error
            ? `Failed to load referrals page: ${error.message}`
            : "Failed to load referrals page."
        );

        setLoading(false);
      }
    }

    loadReferralsPage();
  }, [router]);

  const rewardSummary = useMemo(() => {
    return rewards.reduce(
      (acc, item) => {
        if (item.status === "pending" && !isRewardAvailable(item)) {
          acc.pending += item.amount_cents;
        }

        if (isRewardAvailable(item)) {
          acc.available += item.amount_cents;
        }

        if (item.status === "paid") {
          acc.paid += item.amount_cents;
        }

        return acc;
      },
      {
        pending: 0,
        available: 0,
        paid: 0,
      }
    );
  }, [rewards]);

  async function handleCopyInviteCode() {
    setCopyStatus("");

    if (!profile?.invite_code) {
      setCopyStatus("No invite code available.");
      return;
    }

    try {
      await navigator.clipboard.writeText(profile.invite_code);
      setCopyStatus("Invite code copied.");
    } catch {
      setCopyStatus("Copy failed. Please copy it manually.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
        <section className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-white/60">Loading your referral dashboard...</p>
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
            <Link href="/credits" className="text-white/60 underline">
              Credits
            </Link>
            <Link href="/history" className="text-white/60 underline">
              History
            </Link>
            <Link href="/profile" className="text-white/60 underline">
              Profile
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            SoulLoop Referrals
          </p>

          <h1 className="text-5xl font-bold md:text-6xl">
            Invite & Earn Rewards
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Share your invite code. When invited users complete a paid credit
            purchase, SoulLoop records a referral reward for you. Early-stage
            payouts are reviewed manually.
          </p>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-200">
            {error}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Your Invite Code
              </p>

              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-6">
                <p className="break-all text-4xl font-bold tracking-[0.12em] text-white">
                  {profile?.invite_code || "—"}
                </p>

                <p className="mt-3 text-sm leading-6 text-white/45">
                  Share this code with new users. Referral rewards are created
                  after their successful paid purchase.
                </p>

                <button
                  onClick={handleCopyInviteCode}
                  className="mt-5 rounded-full bg-white px-6 py-3 font-semibold text-black"
                >
                  Copy Invite Code
                </button>

                {copyStatus && (
                  <p className="mt-3 text-sm text-white/55">{copyStatus}</p>
                )}
              </div>

              <p className="mt-5 text-sm leading-6 text-white/45">
                Signed in as{" "}
                <span className="text-white/70">{profile?.email}</span>
              </p>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Reward Summary
              </p>

              <div className="mt-6 grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/40">Pending</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {formatMoney(rewardSummary.pending, "cny")}
                  </p>
                  <p className="mt-2 text-sm text-white/45">
                    Waiting for the pending period to pass.
                  </p>
                </div>

                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                  <p className="text-sm text-emerald-100/60">Available</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {formatMoney(rewardSummary.available, "cny")}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Eligible for manual withdrawal review.
                  </p>

                  <Link
                    href="/withdraw"
                    className="mt-4 inline-block rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
                  >
                    Request Withdrawal
                  </Link>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/40">Paid</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {formatMoney(rewardSummary.paid, "cny")}
                  </p>
                  <p className="mt-2 text-sm text-white/45">
                    Already processed.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.18em] text-white/35">
                Current Rule
              </p>

              <div className="mt-4 space-y-3 text-sm leading-6 text-white/60">
                <p>Reward rate: 20% of referred user paid order amount.</p>
                <p>Reward status: pending first, available after 7 days.</p>
                <p>
                  Withdrawal: early-stage manual review. Automated payouts will
                  be added later.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Invited Users
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                {referrals.length} referral{referrals.length === 1 ? "" : "s"}
              </h2>

              {referrals.length === 0 ? (
                <p className="mt-5 text-white/55">
                  No invited users recorded yet.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {referrals.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-semibold text-white">
                          Referred User
                        </p>

                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-2 break-all text-xs text-white/35">
                        {item.referred_user_id}
                      </p>

                      <p className="mt-2 text-sm text-white/45">
                        Joined through {item.invite_code} ·{" "}
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                Referral Rewards
              </p>

              <h2 className="mt-2 text-2xl font-bold">Reward activity</h2>

              {rewards.length === 0 ? (
                <p className="mt-5 text-white/55">
                  No referral rewards yet. Rewards appear after invited users
                  complete paid purchases.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {rewards.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">
                            {formatMoney(item.amount_cents, item.currency)}
                          </p>

                          <p className="mt-1 text-sm text-white/45">
                            From order{" "}
                            {formatMoney(
                              item.source_amount_cents,
                              item.currency
                            )}{" "}
                            · {item.reward_rate_bps / 100}% reward
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            isRewardAvailable(item)
                              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                              : item.status === "paid"
                              ? "border-white/20 bg-white/10 text-white/70"
                              : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {isRewardAvailable(item)
                            ? "Available"
                            : getRewardStatusLabel(item.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-white/35">
                        Created: {formatDate(item.created_at)}
                      </p>

                      <p className="mt-1 text-xs text-white/35">
                        Available: {formatDate(item.available_at)}
                      </p>

                      <p className="mt-1 break-all text-xs text-white/25">
                        Payment ID: {item.payment_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
