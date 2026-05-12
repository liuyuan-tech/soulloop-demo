import crypto from "crypto";

type AlipayParams = Record<string, string>;

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

function normalizePublicKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

export function getAlipayGateway() {
  return (
    process.env.ALIPAY_GATEWAY ||
    "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
  );
}

export function getAlipayConfig() {
  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;

  if (!appId) {
    throw new Error("Missing ALIPAY_APP_ID");
  }

  if (!privateKey) {
    throw new Error("Missing ALIPAY_PRIVATE_KEY");
  }

  if (!publicKey) {
    throw new Error("Missing ALIPAY_PUBLIC_KEY");
  }

  return {
    appId,
    privateKey: normalizePrivateKey(privateKey),
    publicKey: normalizePublicKey(publicKey),
    gateway: getAlipayGateway(),
  };
}

export function formatAlipayTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function buildSignContent(params: AlipayParams) {
  return Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return key !== "sign" && key !== "sign_type" && value !== undefined && value !== "";
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function signAlipayParams(params: AlipayParams, privateKey: string) {
  const signContent = buildSignContent(params);

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signContent, "utf8");
  signer.end();

  return signer.sign(privateKey, "base64");
}

export function verifyAlipayNotify(params: AlipayParams, publicKey: string) {
  const sign = params.sign;

  if (!sign) {
    return false;
  }

  const signContent = buildSignContent(params);

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signContent, "utf8");
  verifier.end();

  return verifier.verify(publicKey, sign, "base64");
}

export function buildAlipayForm({
  gateway,
  params,
}: {
  gateway: string;
  params: AlipayParams;
}) {
  const inputs = Object.entries(params)
    .map(([key, value]) => {
      const safeKey = escapeHtml(key);
      const safeValue = escapeHtml(value);

      return `<input type="hidden" name="${safeKey}" value="${safeValue}" />`;
    })
    .join("\n");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to Alipay...</title>
  </head>
  <body>
    <form id="alipay-submit-form" method="post" action="${escapeHtml(gateway)}">
      ${inputs}
    </form>
    <script>
      document.getElementById("alipay-submit-form").submit();
    </script>
  </body>
</html>
`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}