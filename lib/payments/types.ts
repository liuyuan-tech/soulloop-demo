export type PaymentProvider = "alipay" | "stripe";

export type PaymentStatus = "created" | "processing" | "completed" | string;

export type ClientPaymentStatus = "completed" | "pending" | "failed";

export type PaymentRow = {
  id: string;
  user_id: string;
  provider: PaymentProvider | string | null;
  status: PaymentStatus | null;
  amount_total: number | null;
  currency: string | null;
  credits_granted: number | null;
  alipay_out_trade_no?: string | null;
  alipay_trade_no?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  provider_order_id?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type CompletePaymentInput = {
  provider: PaymentProvider;
  paymentId?: string;
  alipayOutTradeNo?: string;
  stripeCheckoutSessionId?: string;
  providerTradeNo?: string | null;
  providerOrderId?: string | null;
  stripePaymentIntentId?: string | null;
  reason: string;
  verifiedAmountTotal?: number | null;
  verifiedCurrency?: string | null;
  verifiedUserId?: string | null;
};

export type CompletePaymentResult = {
  status: ClientPaymentStatus;
  alreadyCompleted: boolean;
  payment: PaymentRow;
  creditsBalance: number | null;
};

export type PaymentConfirmationPayload = {
  status: ClientPaymentStatus;
  paymentStatus: string | null;
  provider: string | null;
  paymentId: string;
  outTradeNo: string | null;
  sessionId: string | null;
  credits_granted: number;
  amount_total: number;
  currency: string;
  alipay_trade_no: string | null;
  stripe_payment_intent_id: string | null;
  provider_order_id: string | null;
  completed_at: string | null;
  created_at: string | null;
};
