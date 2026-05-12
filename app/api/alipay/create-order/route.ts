import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildAlipayForm,
  formatAlipayTimestamp,
  getAlipayConfig,
  signAlipayParams,
} from "@/lib/alipay";

type CreateAlipayOrderRequest = {
  packageId?: string;
};

function createOutTradeNo() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SL${Date.now()}${random}`;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace("Bearer ", "").trim();

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

    const body = (await request.json()) as CreateAlipayOrderRequest;
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

    const { appId, privateKey, gateway } = getAlipayConfig();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const outTradeNo = createOutTradeNo();
    const totalAmount = (creditPackage.price_cents / 100).toFixed(2);

    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: totalAmount,
      subject: `SoulLoop ${creditPackage.name}`,
      body: `${creditPackage.credits} SoulLoop credits`,
      passback_params: encodeURIComponent(
        JSON.stringify({
          user_id: user.id,
          package_id: creditPackage.id,
          credits: creditPackage.credits,
        })
      ),
    };

    const params: Record<string, string> = {
      app_id: appId,
      method: "alipay.trade.page.pay",
      format: "JSON",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: formatAlipayTimestamp(),
      version: "1.0",
      notify_url: `${appUrl}/api/alipay/notify`,
      return_url: `${appUrl}/payment-success?provider=alipay&out_trade_no=${outTradeNo}`,
      biz_content: JSON.stringify(bizContent),
    };

    const sign = signAlipayParams(params, privateKey);

    const signedParams = {
      ...params,
      sign,
    };

    const { error: paymentInsertError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        provider: "alipay",
        alipay_out_trade_no: outTradeNo,
        amount_total: creditPackage.price_cents,
        currency: (creditPackage.currency || "cny").toLowerCase(),
        status: "created",
        credits_granted: creditPackage.credits,
      });

    if (paymentInsertError) {
      console.error("ALIPAY_PAYMENT_INSERT_ERROR:", paymentInsertError);

      return NextResponse.json(
        {
          error: `Alipay order was created locally, but payment record failed: ${paymentInsertError.message}`,
        },
        { status: 500 }
      );
    }

    const formHtml = buildAlipayForm({
      gateway,
      params: signedParams,
    });

    return NextResponse.json({
      outTradeNo,
      formHtml,
    });
  } catch (error) {
    console.error("CREATE_ALIPAY_ORDER_ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Alipay create order error: ${error.message}`
            : "Alipay create order error: unknown error",
      },
      { status: 500 }
    );
  }
}