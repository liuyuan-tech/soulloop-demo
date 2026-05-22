import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildPaymentConfirmationPayload,
  completePayment,
  getPaymentForConfirmation,
} from "@/lib/payments/complete-payment";
import { getStripeClient, getStripeId } from "@/lib/stripe";

export const runtime = "nodejs";

type ConfirmStripeSessionRequest = {
  sessionId?: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice("bearer ".length).trim();
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

    const body = (await request.json()) as ConfirmStripeSessionRequest;
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Stripe Checkout Session ID is required." },
        { status: 400 }
      );
    }

    const payment = await getPaymentForConfirmation({
      provider: "stripe",
      stripeCheckoutSessionId: sessionId,
      reason: "stripe_confirm_session",
      verifiedUserId: user.id,
    });

    if (payment.status === "completed") {
      return NextResponse.json(buildPaymentConfirmationPayload(payment));
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const paymentIntentId = getStripeId(session.payment_intent);
      const result = await completePayment({
        provider: "stripe",
        paymentId: payment.id,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        providerTradeNo: paymentIntentId,
        providerOrderId: session.id,
        reason: "stripe_confirm_session",
        verifiedAmountTotal: session.amount_total,
        verifiedCurrency: session.currency,
        verifiedUserId: user.id,
      });

      return NextResponse.json({
        ...buildPaymentConfirmationPayload(result.payment),
        credits_balance: result.creditsBalance,
        already_completed: result.alreadyCompleted,
      });
    }

    return NextResponse.json(buildPaymentConfirmationPayload(payment));
  } catch (error) {
    console.error("CONFIRM_STRIPE_SESSION_ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Stripe confirm session error: unknown error";

    if (message.includes("does not belong")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: `Stripe confirm session error: ${message}`,
      },
      { status: 500 }
    );
  }
}
