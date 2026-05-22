import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { queryAlipayTrade } from "@/lib/alipay";
import {
  buildPaymentConfirmationPayload,
  completePayment,
  getPaymentForConfirmation,
} from "@/lib/payments/complete-payment";

export const runtime = "nodejs";

type ConfirmAlipayOrderRequest = {
  outTradeNo?: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice("bearer ".length).trim();
}

function centsFromAlipayAmount(value: string | null) {
  if (!value) return null;

  const amount = Number(value);

  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
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

    let body: ConfirmAlipayOrderRequest;

    try {
      body = (await request.json()) as ConfirmAlipayOrderRequest;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const outTradeNo = body.outTradeNo?.trim();

    if (!outTradeNo) {
      return NextResponse.json(
        { error: "SoulLoop order number is required." },
        { status: 400 }
      );
    }

    const payment = await getPaymentForConfirmation({
      provider: "alipay",
      alipayOutTradeNo: outTradeNo,
      reason: "alipay_confirm_order",
      verifiedUserId: user.id,
    });

    if (payment.status === "completed") {
      return NextResponse.json(buildPaymentConfirmationPayload(payment));
    }

    try {
      const queryResult = await queryAlipayTrade(outTradeNo);

      if (
        queryResult.tradeStatus === "TRADE_SUCCESS" ||
        queryResult.tradeStatus === "TRADE_FINISHED"
      ) {
        const result = await completePayment({
          provider: "alipay",
          paymentId: payment.id,
          alipayOutTradeNo: outTradeNo,
          providerTradeNo: queryResult.tradeNo,
          providerOrderId: queryResult.tradeNo || outTradeNo,
          reason: "alipay_confirm_order",
          verifiedAmountTotal: centsFromAlipayAmount(queryResult.totalAmount),
          verifiedUserId: user.id,
        });

        return NextResponse.json({
          ...buildPaymentConfirmationPayload(result.payment),
          credits_balance: result.creditsBalance,
          already_completed: result.alreadyCompleted,
        });
      }
    } catch (error) {
      console.error("ALIPAY_CONFIRM_TRADE_QUERY_ERROR:", {
        outTradeNo,
        message: error instanceof Error ? error.message : error,
      });
    }

    return NextResponse.json(buildPaymentConfirmationPayload(payment));
  } catch (error) {
    console.error("CONFIRM_ALIPAY_ORDER_ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Alipay confirm order error: unknown error";

    if (message.includes("does not belong")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: `Alipay confirm order error: ${message}`,
      },
      { status: 500 }
    );
  }
}
