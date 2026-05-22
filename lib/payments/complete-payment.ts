import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ClientPaymentStatus,
  CompletePaymentInput,
  CompletePaymentResult,
  PaymentConfirmationPayload,
  PaymentProvider,
  PaymentRow,
} from "@/lib/payments/types";

const PAYMENT_SELECT =
  "id,user_id,provider,status,amount_total,currency,credits_granted,alipay_out_trade_no,alipay_trade_no,stripe_checkout_session_id,stripe_payment_intent_id,provider_order_id,completed_at,created_at";

function toClientPaymentStatus(status: string | null): ClientPaymentStatus {
  if (status === "completed") return "completed";
  if (status === "created" || status === "pending" || status === "processing") {
    return "pending";
  }
  return "failed";
}

function normalizeCurrency(value: string | null | undefined) {
  return (value || "cny").toLowerCase();
}

function normalizePayment(row: unknown): PaymentRow {
  return row as PaymentRow;
}

function assertPaymentMatchesProvider(payment: PaymentRow, provider: PaymentProvider) {
  if (payment.provider !== provider) {
    throw new Error(
      `Payment provider mismatch. Expected ${provider}, got ${payment.provider || "unknown"}.`
    );
  }
}

function assertVerifiedPayment(input: CompletePaymentInput, payment: PaymentRow) {
  if (input.verifiedUserId && payment.user_id !== input.verifiedUserId) {
    throw new Error("Verified payment user does not match local payment owner.");
  }

  if (
    typeof input.verifiedAmountTotal === "number" &&
    typeof payment.amount_total === "number" &&
    input.verifiedAmountTotal !== payment.amount_total
  ) {
    throw new Error(
      `Verified payment amount mismatch. Expected ${payment.amount_total}, got ${input.verifiedAmountTotal}.`
    );
  }

  if (
    input.verifiedCurrency &&
    normalizeCurrency(input.verifiedCurrency) !== normalizeCurrency(payment.currency)
  ) {
    throw new Error(
      `Verified payment currency mismatch. Expected ${payment.currency}, got ${input.verifiedCurrency}.`
    );
  }
}

async function findPayment(input: CompletePaymentInput) {
  let query = supabaseAdmin.from("payments").select(PAYMENT_SELECT);

  if (input.paymentId) {
    query = query.eq("id", input.paymentId);
  } else if (input.provider === "alipay" && input.alipayOutTradeNo) {
    query = query.eq("provider", "alipay").eq("alipay_out_trade_no", input.alipayOutTradeNo);
  } else if (input.provider === "stripe" && input.stripeCheckoutSessionId) {
    query = query
      .eq("provider", "stripe")
      .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId);
  } else {
    throw new Error("Missing payment identifier.");
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new Error(error?.message || "Payment not found.");
  }

  return normalizePayment(data);
}

async function getPaymentById(paymentId: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("id", paymentId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Completed payment could not be reloaded.");
  }

  return normalizePayment(data);
}

async function getCreditsBalance(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return typeof data.credits_balance === "number" ? data.credits_balance : null;
}

function getRpcResultValue(data: unknown): {
  alreadyCompleted?: boolean;
  creditsBalance?: number | null;
} {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return {};
  }

  return value as {
    alreadyCompleted?: boolean;
    creditsBalance?: number | null;
  };
}

export function buildPaymentConfirmationPayload(
  payment: PaymentRow
): PaymentConfirmationPayload {
  const paymentStatus = typeof payment.status === "string" ? payment.status : null;

  return {
    status: toClientPaymentStatus(paymentStatus),
    paymentStatus,
    provider: payment.provider || null,
    paymentId: payment.id,
    outTradeNo: payment.alipay_out_trade_no || null,
    sessionId: payment.stripe_checkout_session_id || null,
    credits_granted:
      typeof payment.credits_granted === "number" ? payment.credits_granted : 0,
    amount_total: typeof payment.amount_total === "number" ? payment.amount_total : 0,
    currency: payment.currency || "cny",
    alipay_trade_no: payment.alipay_trade_no || null,
    stripe_payment_intent_id: payment.stripe_payment_intent_id || null,
    provider_order_id: payment.provider_order_id || null,
    completed_at: payment.completed_at || null,
    created_at: payment.created_at || null,
  };
}

export async function getPaymentForConfirmation(input: CompletePaymentInput) {
  const payment = await findPayment(input);
  assertPaymentMatchesProvider(payment, input.provider);

  if (input.verifiedUserId && payment.user_id !== input.verifiedUserId) {
    throw new Error("This payment does not belong to the current user.");
  }

  return payment;
}

export async function completePayment(
  input: CompletePaymentInput
): Promise<CompletePaymentResult> {
  const payment = await findPayment(input);
  assertPaymentMatchesProvider(payment, input.provider);
  assertVerifiedPayment(input, payment);

  const { data, error } = await supabaseAdmin.rpc("complete_credit_payment", {
    p_payment_id: payment.id,
    p_provider_trade_no: input.providerTradeNo || null,
    p_provider_order_id: input.providerOrderId || null,
    p_reason: input.reason,
    p_stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    p_stripe_payment_intent_id: input.stripePaymentIntentId || null,
  });

  if (error) {
    throw new Error(`complete_credit_payment RPC failed: ${error.message}`);
  }

  const rpcResult = getRpcResultValue(data);
  const completedPayment = await getPaymentById(payment.id);
  const creditsBalance =
    typeof rpcResult.creditsBalance === "number"
      ? rpcResult.creditsBalance
      : await getCreditsBalance(completedPayment.user_id);

  return {
    status: "completed",
    alreadyCompleted: Boolean(rpcResult.alreadyCompleted),
    payment: completedPayment,
    creditsBalance,
  };
}
