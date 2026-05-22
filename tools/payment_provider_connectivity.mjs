#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");

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

async function checkStripe() {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY is not a test key. Refusing sandbox connectivity test.");
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_.");
  }

  const stripe = new Stripe(secretKey);
  const account = await stripe.accounts.retrieve();

  return {
    ok: true,
    livemode: account.livemode,
    country: account.country || null,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
  };
}

async function checkAlipay() {
  requireEnv("ALIPAY_APP_ID");
  requireEnv("ALIPAY_PRIVATE_KEY");
  requireEnv("ALIPAY_PUBLIC_KEY");

  const gateway =
    process.env.ALIPAY_GATEWAY ||
    "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

  const response = await fetch(gateway, {
    method: "GET",
    cache: "no-store",
  });

  return {
    ok: response.ok,
    gateway,
    status: response.status,
  };
}

async function main() {
  loadEnvFile(envPath);

  const stripe = await checkStripe();
  const alipay = await checkAlipay();

  console.log(
    JSON.stringify(
      {
        stripe,
        alipay,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
