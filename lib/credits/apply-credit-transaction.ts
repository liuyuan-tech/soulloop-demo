import { supabaseAdmin } from "@/lib/supabase/admin";

type ApplyCreditTransactionInput = {
  userId: string;
  amount: number;
  type: "grant" | "usage" | "purchase" | "refund" | "admin_adjust" | string;
  reason?: string | null;
  messageId?: string | null;
};

type ApplyCreditTransactionResult = {
  alreadyApplied: boolean;
  creditsBalance: number | null;
};

function getRpcResultValue(data: unknown): ApplyCreditTransactionResult {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return {
      alreadyApplied: false,
      creditsBalance: null,
    };
  }

  const result = value as {
    alreadyApplied?: boolean;
    creditsBalance?: number | null;
  };

  return {
    alreadyApplied: Boolean(result.alreadyApplied),
    creditsBalance:
      typeof result.creditsBalance === "number" ? result.creditsBalance : null,
  };
}

export async function applyCreditTransaction(
  input: ApplyCreditTransactionInput
): Promise<ApplyCreditTransactionResult> {
  const { data, error } = await supabaseAdmin.rpc("apply_credit_transaction", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_type: input.type,
    p_reason: input.reason || null,
    p_message_id: input.messageId || null,
  });

  if (error) {
    throw new Error(`apply_credit_transaction RPC failed: ${error.message}`);
  }

  return getRpcResultValue(data);
}
