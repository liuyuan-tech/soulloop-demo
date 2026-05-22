#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");
const baseUrl = process.argv.find((value) => value.startsWith("--base-url="))?.split("=")[1] || "http://127.0.0.1:3000";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function logStep(message) {
  console.log(`\n== ${message} ==`);
}

function migrationHint() {
  return [
    "",
    "Apply the Supabase migration before rerunning:",
    path.join(rootDir, "supabase/migrations/20260522000000_payment_completion.sql"),
    "",
    "Supabase Dashboard path:",
    "Project > SQL Editor > New query > paste the migration SQL > Run",
  ].join("\n");
}

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson(pathname, token, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let data = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { rawText };
  }

  if (!response.ok) {
    throw new Error(
      `${pathname} failed with ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return { response, data };
}

async function postText(pathname, headers, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
    body,
  });

  return {
    status: response.status,
    text: await response.text(),
  };
}

async function ensureDevServer() {
  const response = await fetch(`${baseUrl}/credits`, {
    redirect: "manual",
  });

  assertOk(
    response.status === 200,
    `Local app did not respond with 200 at ${baseUrl}/credits. Got ${response.status}.`
  );
}

async function createSmokeUser(admin, publicClient) {
  const stamp = Date.now();
  const email = `soulloop-smoke+${stamp}@example.com`;
  const password = `Smoke-${stamp}-Test`;

  const { data: createData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "soulloop_sandbox_payment_smoke_test",
      },
    });

  if (createError || !createData.user) {
    throw new Error(
      `Could not create smoke user: ${createError?.message || "unknown error"}`
    );
  }

  const { data: signInData, error: signInError } =
    await publicClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signInData.session?.access_token) {
    throw new Error(
      `Could not sign in smoke user: ${signInError?.message || "unknown error"}`
    );
  }

  return {
    email,
    userId: createData.user.id,
    token: signInData.session.access_token,
  };
}

async function selectCreditPackage(admin) {
  const { data, error } = await admin
    .from("credit_packages")
    .select("id,name,credits,price_cents,currency,active")
    .eq("active", true)
    .order("price_cents", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Could not load active credit package: ${error.message}`);
  }

  if (!data?.length) {
    throw new Error("No active credit package found.");
  }

  return data[0];
}

async function getProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,credits_balance,invite_code")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(`Could not load profile: ${error?.message || "not found"}`);
  }

  return data;
}

async function checkDatabaseReadiness(admin) {
  const schemaErrors = [];
  const paymentCheck = await admin
    .from("payments")
    .select(
      "id,provider,status,amount_total,currency,credits_granted,provider_order_id,stripe_checkout_session_id,stripe_payment_intent_id,completed_at"
    )
    .limit(1);

  if (paymentCheck.error) {
    schemaErrors.push(`payments schema check failed: ${paymentCheck.error.message}`);
  }

  const transactionCheck = await admin
    .from("credit_transactions")
    .select(
      "id,user_id,amount,type,reason,payment_id,provider,stripe_session_id,stripe_checkout_session_id,alipay_out_trade_no"
    )
    .limit(1);

  if (transactionCheck.error) {
    schemaErrors.push(
      `credit_transactions schema check failed: ${transactionCheck.error.message}`
    );
  }

  const rpcCheck = await admin.rpc("complete_credit_payment", {
    p_payment_id: "00000000-0000-0000-0000-000000000000",
    p_provider_trade_no: null,
    p_provider_order_id: null,
    p_reason: "smoke_rpc_check",
    p_stripe_checkout_session_id: null,
    p_stripe_payment_intent_id: null,
  });

  if (
    !rpcCheck.error ||
    !String(rpcCheck.error.message || "").toLowerCase().includes("payment not found")
  ) {
    schemaErrors.push(
      `complete_credit_payment RPC check failed unexpectedly: ${
        rpcCheck.error?.message || "RPC did not reject dummy payment"
      }`
    );
  }

  if (schemaErrors.length > 0) {
    throw new Error(
      `Database readiness failed:\n- ${schemaErrors.join("\n- ")}${migrationHint()}`
    );
  }
}

async function runStripeSmoke({ admin, stripe, webhookSecret, token, userId, creditPackage }) {
  logStep("Stripe create-checkout-session");

  const { data } = await postJson("/api/stripe/create-checkout-session", token, {
    packageId: creditPackage.id,
  });

  assertOk(data.sessionId, "Stripe sessionId missing from create response.");
  assertOk(data.paymentId, "Stripe paymentId missing from create response.");
  assertOk(data.url?.startsWith("https://checkout.stripe.com/"), "Stripe Checkout URL missing or invalid.");

  const session = await stripe.checkout.sessions.retrieve(data.sessionId);

  assertOk(session.id === data.sessionId, "Stripe session retrieve mismatch.");
  assertOk(session.payment_status === "unpaid", "New Stripe session should start unpaid.");
  assertOk(session.metadata?.payment_id === data.paymentId, "Stripe metadata payment_id mismatch.");
  assertOk(session.metadata?.user_id === userId, "Stripe metadata user_id mismatch.");

  console.log(`created session: ${data.sessionId}`);
  console.log(`checkout url: ${data.url}`);

  logStep("Stripe signed webhook + idempotency");

  const beforeProfile = await getProfile(admin, userId);
  const paymentIntentId = `pi_smoke_${Date.now()}`;
  const eventPayload = JSON.stringify({
    id: `evt_smoke_${Date.now()}`,
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: data.sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: creditPackage.price_cents,
        currency: (creditPackage.currency || "usd").toLowerCase(),
        metadata: {
          payment_id: data.paymentId,
          user_id: userId,
          package_id: creditPackage.id,
          credits: String(creditPackage.credits),
        },
        payment_intent: paymentIntentId,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: webhookSecret,
  });

  const firstWebhook = await postText(
    "/api/stripe/webhook",
    {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    eventPayload
  );

  assertOk(
    firstWebhook.status === 200 && firstWebhook.text.trim() === "ok",
    `Stripe webhook first call failed: ${firstWebhook.status} ${firstWebhook.text}`
  );

  const afterFirstProfile = await getProfile(admin, userId);

  assertOk(
    afterFirstProfile.credits_balance === beforeProfile.credits_balance + creditPackage.credits,
    `Stripe credits were not granted once. Before ${beforeProfile.credits_balance}, after ${afterFirstProfile.credits_balance}, expected +${creditPackage.credits}.`
  );

  const secondWebhook = await postText(
    "/api/stripe/webhook",
    {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    eventPayload
  );

  assertOk(
    secondWebhook.status === 200 && secondWebhook.text.trim() === "ok",
    `Stripe webhook replay failed: ${secondWebhook.status} ${secondWebhook.text}`
  );

  const afterReplayProfile = await getProfile(admin, userId);

  assertOk(
    afterReplayProfile.credits_balance === afterFirstProfile.credits_balance,
    `Stripe webhook replay duplicated credits. First ${afterFirstProfile.credits_balance}, replay ${afterReplayProfile.credits_balance}.`
  );

  const { data: purchaseRows, error: purchaseError } = await admin
    .from("credit_transactions")
    .select("id,amount,type,reason,payment_id,provider,stripe_checkout_session_id")
    .eq("payment_id", data.paymentId)
    .eq("type", "purchase");

  if (purchaseError) {
    throw new Error(`Could not read purchase credit transaction: ${purchaseError.message}`);
  }

  assertOk(purchaseRows.length === 1, `Expected 1 purchase transaction, got ${purchaseRows.length}.`);
  assertOk(purchaseRows[0].amount === creditPackage.credits, "Purchase transaction credit amount mismatch.");
  assertOk(purchaseRows[0].provider === "stripe", "Purchase transaction provider mismatch.");

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id,status,provider,stripe_checkout_session_id,stripe_payment_intent_id,completed_at")
    .eq("id", data.paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Could not read Stripe payment row: ${paymentError?.message || "not found"}`);
  }

  assertOk(payment.status === "completed", `Stripe payment status is ${payment.status}, expected completed.`);
  assertOk(payment.stripe_checkout_session_id === data.sessionId, "Stripe payment session id not stored.");
  assertOk(payment.stripe_payment_intent_id === paymentIntentId, "Stripe payment intent id not stored.");

  return {
    checkoutUrl: data.url,
    sessionId: data.sessionId,
    paymentId: data.paymentId,
  };
}

async function runAlipaySmoke({ admin, token, userId, creditPackage, appId }) {
  logStep("Alipay create-order");

  const { data } = await postJson("/api/alipay/create-order", token, {
    packageId: creditPackage.id,
  });

  assertOk(data.outTradeNo, "Alipay outTradeNo missing from create response.");
  assertOk(
    typeof data.formHtml === "string" && data.formHtml.includes("alipay-submit-form"),
    "Alipay form HTML missing or invalid."
  );

  const formPath = path.join(rootDir, ".local-logs", `alipay-smoke-${data.outTradeNo}.html`);
  fs.mkdirSync(path.dirname(formPath), { recursive: true });
  fs.writeFileSync(formPath, data.formHtml, "utf8");

  console.log(`created out_trade_no: ${data.outTradeNo}`);
  console.log(`saved redirect form: ${formPath}`);

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id,status,provider,alipay_out_trade_no,provider_order_id")
    .eq("provider", "alipay")
    .eq("alipay_out_trade_no", data.outTradeNo)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Could not read Alipay payment row: ${paymentError?.message || "not found"}`);
  }

  assertOk(payment.status === "created", `Alipay payment status is ${payment.status}, expected created.`);

  logStep("Alipay unpaid confirm-order");

  const confirm = await postJson("/api/alipay/confirm-order", token, {
    outTradeNo: data.outTradeNo,
  });

  assertOk(confirm.data.provider === "alipay", "Alipay confirm provider mismatch.");
  assertOk(
    confirm.data.status === "pending" || confirm.data.status === "completed",
    `Alipay confirm returned unexpected status: ${confirm.data.status}`
  );

  logStep("Alipay notify verification rejects unsigned callback");

  const beforeProfile = await getProfile(admin, userId);
  const unsignedNotify = new URLSearchParams({
    app_id: appId,
    out_trade_no: data.outTradeNo,
    trade_no: `fake_${Date.now()}`,
    trade_status: "TRADE_SUCCESS",
    total_amount: (creditPackage.price_cents / 100).toFixed(2),
  });

  const notify = await postText(
    "/api/alipay/notify",
    {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    unsignedNotify.toString()
  );

  assertOk(
    notify.status === 200 && notify.text.trim() === "failure",
    `Unsigned Alipay notify should fail, got ${notify.status} ${notify.text}`
  );

  const afterProfile = await getProfile(admin, userId);

  assertOk(
    afterProfile.credits_balance === beforeProfile.credits_balance,
    "Unsigned Alipay notify changed credits."
  );

  return {
    outTradeNo: data.outTradeNo,
    formPath,
  };
}

async function main() {
  loadEnvFile(envPath);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  const alipayAppId = requireEnv("ALIPAY_APP_ID");

  assertOk(stripeSecretKey.startsWith("sk_test_"), "STRIPE_SECRET_KEY must be a Stripe test key for sandbox smoke tests.");
  assertOk(stripeWebhookSecret.startsWith("whsec_"), "STRIPE_WEBHOOK_SECRET must start with whsec_.");

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, supabaseAnonKey);
  const stripe = new Stripe(stripeSecretKey);

  logStep("Local app and database readiness");
  await ensureDevServer();
  await checkDatabaseReadiness(admin);
  console.log("local app: reachable");
  console.log("database: payment columns and RPC ready");

  logStep("Smoke user and package");
  const smokeUser = await createSmokeUser(admin, publicClient);
  await postText(
    "/api/referrals/ensure-invite-code",
    {
      Authorization: `Bearer ${smokeUser.token}`,
    },
    ""
  );
  const profile = await getProfile(admin, smokeUser.userId);
  const creditPackage = await selectCreditPackage(admin);
  console.log(`smoke user: ${smokeUser.email}`);
  console.log(`initial credits: ${profile.credits_balance}`);
  console.log(`package: ${creditPackage.name} / ${creditPackage.credits} credits / ${creditPackage.price_cents} ${(creditPackage.currency || "").toUpperCase()}`);

  const stripeResult = await runStripeSmoke({
    admin,
    stripe,
    webhookSecret: stripeWebhookSecret,
    token: smokeUser.token,
    userId: smokeUser.userId,
    creditPackage,
  });

  const alipayResult = await runAlipaySmoke({
    admin,
    token: smokeUser.token,
    userId: smokeUser.userId,
    creditPackage,
    appId: alipayAppId,
  });

  logStep("Sandbox smoke summary");
  console.log("Stripe: create-checkout-session passed");
  console.log("Stripe: signed webhook verification passed");
  console.log("Stripe: completePayment idempotency passed");
  console.log("Stripe: credit_transactions purchase row passed");
  console.log("Alipay: signed order form generation passed");
  console.log("Alipay: confirm-order route reachable");
  console.log("Alipay: unsigned notify rejected");
  console.log(`Stripe checkout URL for manual card test: ${stripeResult.checkoutUrl}`);
  console.log(`Alipay form for manual sandbox buyer test: ${alipayResult.formPath}`);
}

main().catch((error) => {
  console.error("\nSandbox smoke test failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
