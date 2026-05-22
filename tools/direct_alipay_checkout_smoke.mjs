#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function cleanKey(value) {
  return value.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

function stripPemHeaders(value) {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function chunkKeyBody(value) {
  const body = stripPemHeaders(value);
  return body.match(/.{1,64}/g)?.join("\n") || body;
}

function normalizePrivateKey(key) {
  const cleaned = cleanKey(key);

  if (
    cleaned.includes("-----BEGIN PRIVATE KEY-----") ||
    cleaned.includes("-----BEGIN RSA PRIVATE KEY-----")
  ) {
    return cleaned;
  }

  return `-----BEGIN RSA PRIVATE KEY-----\n${chunkKeyBody(cleaned)}\n-----END RSA PRIVATE KEY-----`;
}

function normalizePrivateKeyAsPkcs8(key) {
  return `-----BEGIN PRIVATE KEY-----\n${chunkKeyBody(cleanKey(key))}\n-----END PRIVATE KEY-----`;
}

function formatAlipayTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function buildRequestSignContent(params) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signWithKey(signContent, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signContent, "utf8");
  signer.end();

  return signer.sign(privateKey, "base64");
}

function signAlipayParams(params, privateKey, fallbackPrivateKey) {
  const signContent = buildRequestSignContent(params);

  try {
    return signWithKey(signContent, privateKey);
  } catch {
    return signWithKey(signContent, fallbackPrivateKey);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildForm(gateway, params) {
  const inputs = Object.entries(params)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`
    )
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SoulLoop Alipay Sandbox Smoke</title>
  </head>
  <body>
    <form id="alipay-submit-form" method="get" accept-charset="utf-8" action="${escapeHtml(
      gateway
    )}">
      ${inputs}
    </form>
    <script>document.getElementById("alipay-submit-form").submit();</script>
  </body>
</html>`;
}

function main() {
  loadEnvFile(envPath);

  const appId = requireEnv("ALIPAY_APP_ID");
  const rawPrivateKey = requireEnv("ALIPAY_PRIVATE_KEY");
  const gateway =
    process.env.ALIPAY_GATEWAY ||
    "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(
      /\/+$/,
      ""
    );
  const outTradeNo = `SLDIRECT${Date.now()}`;
  const privateKey = normalizePrivateKey(rawPrivateKey);
  const privateKeyPkcs8 = normalizePrivateKeyAsPkcs8(rawPrivateKey);

  const bizContent = {
    out_trade_no: outTradeNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: "0.01",
    subject: "SoulLoop direct Alipay sandbox smoke test",
    body: "Direct sandbox-only signature and gateway test",
  };

  const params = {
    app_id: appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTimestamp(),
    version: "1.0",
    notify_url: `${appUrl}/api/alipay/notify`,
    return_url: `${appUrl}/payment-success?provider=alipay&direct_smoke=1`,
    biz_content: JSON.stringify(bizContent),
  };

  const sign = signAlipayParams(params, privateKey, privateKeyPkcs8);
  const html = buildForm(gateway, { ...params, sign });
  const outputDir = path.join(rootDir, ".local-logs");
  const outputPath = path.join(outputDir, `alipay-direct-smoke-${outTradeNo}.html`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");

  console.log(
    JSON.stringify(
      {
        outTradeNo,
        formPath: outputPath,
        fileUrl: `file://${outputPath}`,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
