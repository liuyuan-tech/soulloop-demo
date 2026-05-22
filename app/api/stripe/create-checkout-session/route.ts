import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl, getStripeClient, getStripeId } from "@/lib/stripe";

export const runtime = "nodejs";

type CreateStripeCheckoutRequest = {
  packageId?: string;
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

    const body = (await request.json()) as CreateStripeCheckoutRequest;
    const packageId = body.packageId;

    if (!packageId) {
      return NextResponse.json(
        { error: "Credit package ID is required." },
        { status: 400 }
      );
    }

    const { data: creditPackage, error: packageError } = await supabaseAdmin
      .from("credit_packages")
      .select("id,name,credits,price_cents,currency,active")
      .eq("id", packageId)
      .eq("active", true)
      .single();

    if (packageError || !creditPackage) {
      return NextResponse.json(
        {
          error:
            packageError?.message ||
            "Credit package not found or inactive.",
        },
        { status: 404 }
      );
    }

    const { data: payment, error: paymentInsertError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        provider: "stripe",
        amount_total: creditPackage.price_cents,
        currency: (creditPackage.currency || "usd").toLowerCase(),
        status: "created",
        credits_granted: creditPackage.credits,
      })
      .select("id")
      .single();

    if (paymentInsertError || !payment) {
      return NextResponse.json(
        {
          error: `Stripe payment record failed: ${
            paymentInsertError?.message || "unknown error"
          }`,
        },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();
    const paymentId = payment.id as string;
    const metadata = {
      payment_id: paymentId,
      user_id: user.id,
      package_id: creditPackage.id,
      credits: String(creditPackage.credits),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: paymentId,
      success_url: `${appUrl}/payment-success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment-cancel?provider=stripe`,
      metadata,
      payment_intent_data: {
        metadata,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (creditPackage.currency || "usd").toLowerCase(),
            unit_amount: creditPackage.price_cents,
            product_data: {
              name: `SoulLoop ${creditPackage.name}`,
              description: `${creditPackage.credits} SoulLoop credits`,
            },
          },
        },
      ],
    });

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: getStripeId(session.payment_intent),
        provider_order_id: session.id,
      })
      .eq("id", paymentId);

    if (paymentUpdateError) {
      console.error("STRIPE_PAYMENT_SESSION_UPDATE_ERROR:", paymentUpdateError);
      return NextResponse.json(
        {
          error: `Stripe session was created, but local payment update failed: ${paymentUpdateError.message}`,
        },
        { status: 500 }
      );
    }

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkout session did not return a URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      paymentId,
      url: session.url,
    });
  } catch (error) {
    console.error("CREATE_STRIPE_CHECKOUT_SESSION_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Stripe checkout error: ${error.message}`
            : "Stripe checkout error: unknown error",
      },
      { status: 500 }
    );
  }
}
