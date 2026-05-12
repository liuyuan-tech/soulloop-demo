import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAlipayConfig, verifyAlipayNotify } from "@/lib/alipay";

export const runtime = "nodejs";

function textResponse(value: string) {
  return new NextResponse(value, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    const { publicKey } = getAlipayConfig();

    const isValid = verifyAlipayNotify(params, publicKey);

    if (!isValid) {
      console.error("ALIPAY_NOTIFY_VERIFY_FAILED:", params);
      return textResponse("failure");
    }

    const outTradeNo = params.out_trade_no;
    const alipayTradeNo = params.trade_no;
    const tradeStatus = params.trade_status;
    const totalAmount = params.total_amount;

    if (!outTradeNo) {
      console.error("ALIPAY_NOTIFY_MISSING_OUT_TRADE_NO:", params);
      return textResponse("failure");
    }

    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      console.log("ALIPAY_NOTIFY_IGNORED_STATUS:", {
        outTradeNo,
        tradeStatus,
      });

      return textResponse("success");
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(
        "id,user_id,status,amount_total,currency,credits_granted,alipay_out_trade_no,alipay_trade_no"
      )
      .eq("alipay_out_trade_no", outTradeNo)
      .single();

    if (paymentError || !payment) {
      console.error("ALIPAY_PAYMENT_NOT_FOUND:", paymentError);
      return textResponse("failure");
    }

    if (payment.status === "completed") {
      return textResponse("success");
    }

    const expectedAmount = (payment.amount_total / 100).toFixed(2);

    if (totalAmount && Number(totalAmount).toFixed(2) !== expectedAmount) {
      console.error("ALIPAY_AMOUNT_MISMATCH:", {
        outTradeNo,
        expectedAmount,
        totalAmount,
      });

      return textResponse("failure");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,credits_balance")
      .eq("id", payment.user_id)
      .single();

    if (profileError || !profile) {
      console.error("ALIPAY_PROFILE_NOT_FOUND:", profileError);
      return textResponse("failure");
    }

    const creditsToGrant =
      typeof payment.credits_granted === "number"
        ? payment.credits_granted
        : 0;

    if (creditsToGrant <= 0) {
      console.error("ALIPAY_INVALID_CREDITS:", {
        outTradeNo,
        creditsToGrant,
      });

      return textResponse("failure");
    }

    const currentCredits =
      typeof profile.credits_balance === "number"
        ? profile.credits_balance
        : 0;

    const newCreditsBalance = currentCredits + creditsToGrant;

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        credits_balance: newCreditsBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.user_id);

    if (profileUpdateError) {
      console.error("ALIPAY_PROFILE_UPDATE_ERROR:", profileUpdateError);
      return textResponse("failure");
    }

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        provider: "alipay",
        status: "completed",
        alipay_trade_no: alipayTradeNo || null,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      console.error("ALIPAY_PAYMENT_UPDATE_ERROR:", paymentUpdateError);
      return textResponse("failure");
    }

    const { error: transactionError } = await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: payment.user_id,
        amount: creditsToGrant,
        type: "purchase",
        reason: "alipay_checkout",
        alipay_out_trade_no: outTradeNo,
      });

    if (transactionError) {
      console.error("ALIPAY_TRANSACTION_INSERT_ERROR:", transactionError);
      return textResponse("failure");
    }

    return textResponse("success");
  } catch (error) {
    console.error("ALIPAY_NOTIFY_ERROR:", error);
    return textResponse("failure");
  }
}

export async function GET() {
  return textResponse("alipay notify endpoint");
}