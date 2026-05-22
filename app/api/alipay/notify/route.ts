import { NextResponse } from "next/server";
import { getAlipayConfig, verifyAlipayNotify } from "@/lib/alipay";
import {
  buildPaymentConfirmationPayload,
  completePayment,
  getPaymentForConfirmation,
} from "@/lib/payments/complete-payment";

export const runtime = "nodejs";

function textResponse(value: string) {
  return new NextResponse(value, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function centsFromAlipayAmount(value: string | undefined) {
  if (!value) return null;

  const amount = Number(value);

  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    console.log("ALIPAY_NOTIFY_RECEIVED:", {
      out_trade_no: params.out_trade_no,
      trade_no: params.trade_no,
      trade_status: params.trade_status,
      total_amount: params.total_amount,
      app_id: params.app_id,
      seller_id: params.seller_id,
      notify_time: params.notify_time,
    });

    const { appId, publicKey } = getAlipayConfig();

    if (params.app_id !== appId) {
      console.error("ALIPAY_APP_ID_MISMATCH:", {
        expected: appId,
        actual: params.app_id,
      });
      return textResponse("failure");
    }

    const verifyPassed = verifyAlipayNotify(params, publicKey);

    if (!verifyPassed) {
      console.error("ALIPAY_NOTIFY_VERIFY_FAILED_BLOCKED");
      return textResponse("failure");
    }

    const outTradeNo = params.out_trade_no;
    const alipayTradeNo = params.trade_no;
    const tradeStatus = params.trade_status;

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

    const payment = await getPaymentForConfirmation({
      provider: "alipay",
      alipayOutTradeNo: outTradeNo,
      reason: "alipay_checkout",
    });

    const verifiedAmountTotal = centsFromAlipayAmount(params.total_amount);

    if (
      typeof verifiedAmountTotal === "number" &&
      typeof payment.amount_total === "number" &&
      verifiedAmountTotal !== payment.amount_total
    ) {
      console.error("ALIPAY_AMOUNT_MISMATCH:", {
        outTradeNo,
        expectedAmountCents: payment.amount_total,
        verifiedAmountCents: verifiedAmountTotal,
        totalAmount: params.total_amount,
      });
      return textResponse("failure");
    }

    const result = await completePayment({
      provider: "alipay",
      paymentId: payment.id,
      alipayOutTradeNo: outTradeNo,
      providerTradeNo: alipayTradeNo || null,
      providerOrderId: alipayTradeNo || outTradeNo,
      reason: "alipay_checkout",
      verifiedAmountTotal,
    });

    console.log("ALIPAY_NOTIFY_PROCESS_SUCCESS:", {
      outTradeNo,
      alipayTradeNo,
      payment: buildPaymentConfirmationPayload(result.payment),
      creditsBalance: result.creditsBalance,
      alreadyCompleted: result.alreadyCompleted,
      verifyPassed,
      sandboxBypassUsed: false,
    });

    return textResponse("success");
  } catch (error) {
    console.error("ALIPAY_NOTIFY_ERROR:", error);
    return textResponse("failure");
  }
}

export async function GET() {
  return textResponse("alipay notify endpoint");
}
