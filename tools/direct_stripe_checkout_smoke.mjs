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

async function main() {
  loadEnvFile(envPath);

  const secretKey = requireEnv("STRIPE_SECRET_KEY");

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY is not a test key. Refusing direct sandbox checkout.");
  }

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url:
      "http://127.0.0.1:3000/payment-success?provider=stripe&direct_smoke=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url:
      "http://127.0.0.1:3000/payment-cancel?provider=stripe&direct_smoke=1",
    metadata: {
      source: "soulloop_direct_stripe_checkout_smoke",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: 800,
          product_data: {
            name: "SoulLoop direct Stripe smoke test",
          },
        },
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        id: session.id,
        payment_status: session.payment_status,
        url: session.url,
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
