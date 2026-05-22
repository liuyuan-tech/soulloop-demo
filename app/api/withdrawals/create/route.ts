import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type CreateWithdrawalRequest = {
  amountCents?: number;
  payoutMethod?: "alipay" | "paypal" | "bank";
  accountDetails?: string;
};

const ACTIVE_WITHDRAWAL_STATUSES = ["pending", "approved"];

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice("bearer ".length).trim();
}

function isWithdrawableReward(row: {
  status?: string | null;
  available_at?: string | null;
}) {
  return (
    row.status === "available" ||
    (row.status === "pending" &&
      Boolean(row.available_at) &&
      new Date(row.available_at as string).getTime() <= Date.now())
  );
}

function sumAmount(rows: Array<{ amount_cents: number | null }> | null) {
  return (rows || []).reduce((total, row) => {
    return total + (typeof row.amount_cents === "number" ? row.amount_cents : 0);
  }, 0);
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please log in again." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateWithdrawalRequest;
    const amountCents = Math.floor(Number(body.amountCents || 0));
    const payoutMethod = body.payoutMethod;
    const accountDetails = (body.accountDetails || "").trim();

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: "Withdrawal amount must be greater than zero." },
        { status: 400 }
      );
    }

    if (!payoutMethod || !["alipay", "paypal", "bank"].includes(payoutMethod)) {
      return NextResponse.json(
        { error: "Please choose a valid payout method." },
        { status: 400 }
      );
    }

    if (!accountDetails) {
      return NextResponse.json(
        { error: "Please enter payout account details." },
        { status: 400 }
      );
    }

    const [availableRewardsResult, activeWithdrawalsResult] = await Promise.all([
      supabaseAdmin
        .from("referral_rewards")
        .select("amount_cents,status,available_at")
        .eq("referrer_user_id", user.id)
        .in("status", ["available", "pending"]),
      supabaseAdmin
        .from("withdrawal_requests")
        .select("amount_cents")
        .eq("user_id", user.id)
        .in("status", ACTIVE_WITHDRAWAL_STATUSES),
    ]);

    if (availableRewardsResult.error) {
      return NextResponse.json(
        { error: `Rewards load error: ${availableRewardsResult.error.message}` },
        { status: 500 }
      );
    }

    if (activeWithdrawalsResult.error) {
      return NextResponse.json(
        {
          error: `Withdrawal load error: ${activeWithdrawalsResult.error.message}`,
        },
        { status: 500 }
      );
    }

    const availableCents = sumAmount(
      (availableRewardsResult.data || []).filter(isWithdrawableReward)
    );
    const activeWithdrawalCents = sumAmount(activeWithdrawalsResult.data);
    const withdrawableCents = Math.max(0, availableCents - activeWithdrawalCents);

    if (amountCents > withdrawableCents) {
      return NextResponse.json(
        {
          error: "Withdrawal amount exceeds available referral reward balance.",
          availableCents,
          activeWithdrawalCents,
          withdrawableCents,
        },
        { status: 400 }
      );
    }

    const { data: withdrawal, error: insertError } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        currency: "cny",
        payout_method: payoutMethod,
        account_details: {
          value: accountDetails,
        },
        status: "pending",
      })
      .select("id,status,amount_cents,currency,payout_method,created_at")
      .single();

    if (insertError || !withdrawal) {
      return NextResponse.json(
        {
          error:
            insertError?.message || "Withdrawal request could not be created.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      withdrawal,
      availableCents,
      activeWithdrawalCents,
      withdrawableCents: withdrawableCents - amountCents,
    });
  } catch (error) {
    console.error("CREATE_WITHDRAWAL_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Create withdrawal error: ${error.message}`
            : "Create withdrawal error.",
      },
      { status: 500 }
    );
  }
}
