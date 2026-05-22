import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { completePayment } from "@/lib/payments/complete-payment";
import { getStripeClient, getStripeId, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function textResponse(value: string, status = 200) {
  return new NextResponse(value, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    console.error("STRIPE_WEBHOOK_MISSING_SIGNATURE");
    return textResponse("missing signature", 400);
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("STRIPE_WEBHOOK_SIGNATURE_VERIFY_FAILED:", error);
    return textResponse("invalid signature", 400);
  }

  try {
    if (event.type !== "checkout.session.completed") {
      return textResponse("ok");
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      console.log("STRIPE_CHECKOUT_SESSION_NOT_PAID:", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
      return textResponse("ok");
    }

    const paymentId = session.metadata?.payment_id || undefined;
    const paymentIntentId = getStripeId(session.payment_intent);

    await completePayment({
      provider: "stripe",
      paymentId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      providerTradeNo: paymentIntentId,
      providerOrderId: session.id,
      reason: "stripe_checkout",
      verifiedAmountTotal: session.amount_total,
      verifiedCurrency: session.currency,
      verifiedUserId: session.metadata?.user_id || null,
    });

    return textResponse("ok");
  } catch (error) {
    console.error("STRIPE_WEBHOOK_PROCESS_ERROR:", error);
    return textResponse("webhook processing failed", 500);
  }
}
