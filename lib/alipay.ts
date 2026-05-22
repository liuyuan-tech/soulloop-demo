import crypto from "crypto";

type AlipayParams = Record<string, string>;

export type AlipayTradeQueryResult = {
  tradeStatus: string | null;
  tradeNo: string | null;
  outTradeNo: string | null;
  totalAmount: string | null;
  raw: unknown;
};

function cleanKey(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

function stripPemHeaders(value: string) {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function chunkKeyBody(value: string) {
  const body = stripPemHeaders(value);
  return body.match(/.{1,64}/g)?.join("\n") || body;
}

function normalizePrivateKey(key: string) {
  const cleaned = cleanKey(key);

  if (
    cleaned.includes("-----BEGIN PRIVATE KEY-----") ||
    cleaned.includes("-----BEGIN RSA PRIVATE KEY-----")
  ) {
    return cleaned;
  }

  const body = chunkKeyBody(cleaned);

  return `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`;
}

function normalizePrivateKeyAsPkcs8(key: string) {
  const cleaned = cleanKey(key);
  const body = chunkKeyBody(cleaned);

  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

function normalizePublicKey(key: string) {
  const cleaned = cleanKey(key);

  if (cleaned.includes("-----BEGIN PUBLIC KEY-----")) {
    return cleaned;
  }

  const body = chunkKeyBody(cleaned);

  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
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
    privateKeyPkcs8Fallback: normalizePrivateKeyAsPkcs8(privateKey),
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

/**
 * 用于“请求支付宝网关”的签名字符串。
 * 当前 page.pay 跳转已验证可用：只排除 sign，保留 sign_type。
 */
export function buildRequestSignContent(params: AlipayParams) {
  return Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return key !== "sign" && value !== undefined && value !== "";
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

/**
 * 用于“支付宝异步通知 notify”的验签字符串。
 * notify 验签需要排除 sign 和 sign_type。
 */
export function buildNotifySignContent(params: AlipayParams) {
  return Object.keys(params)
    .filter((key) => {
      const value = params[key];

      return (
        key !== "sign" &&
        key !== "sign_type" &&
        value !== undefined &&
        value !== ""
      );
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signWithKey(signContent: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signContent, "utf8");
  signer.end();

  return signer.sign(privateKey, "base64");
}

export function signAlipayParams(
  params: AlipayParams,
  privateKey: string,
  privateKeyPkcs8Fallback?: string
) {
  const signContent = buildRequestSignContent(params);

  try {
    return signWithKey(signContent, privateKey);
  } catch (firstError) {
    if (privateKeyPkcs8Fallback) {
      try {
        console.warn(
          "ALIPAY_SIGN_PKCS1_FAILED_TRYING_PKCS8:",
          firstError instanceof Error ? firstError.message : firstError
        );

        return signWithKey(signContent, privateKeyPkcs8Fallback);
      } catch (secondError) {
        console.error("ALIPAY_SIGN_ERROR_BOTH_FORMATS_FAILED:", {
          firstMessage:
            firstError instanceof Error ? firstError.message : firstError,
          secondMessage:
            secondError instanceof Error ? secondError.message : secondError,
          signContentPreview: signContent.slice(0, 300),
          privateKeyStartsWith: privateKey.slice(0, 40),
          privateKeyEndsWith: privateKey.slice(-40),
        });

        throw secondError;
      }
    }

    console.error("ALIPAY_SIGN_ERROR:", {
      message: firstError instanceof Error ? firstError.message : firstError,
      signContentPreview: signContent.slice(0, 300),
      privateKeyStartsWith: privateKey.slice(0, 40),
      privateKeyEndsWith: privateKey.slice(-40),
    });

    throw firstError;
  }
}

export function verifyAlipayNotify(params: AlipayParams, publicKey: string) {
  const sign = params.sign;

  if (!sign) {
    console.error("ALIPAY_NOTIFY_MISSING_SIGN");
    return false;
  }

  const signContent = buildNotifySignContent(params);

  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signContent, "utf8");
    verifier.end();

    const isValid = verifier.verify(publicKey, sign, "base64");

    if (!isValid) {
      console.error("ALIPAY_NOTIFY_VERIFY_FALSE:", {
        signContentPreview: signContent.slice(0, 800),
        publicKeyStartsWith: publicKey.slice(0, 40),
        publicKeyEndsWith: publicKey.slice(-40),
      });
    }

    return isValid;
  } catch (error) {
    console.error("ALIPAY_VERIFY_ERROR:", {
      message: error instanceof Error ? error.message : error,
      signContentPreview: signContent.slice(0, 800),
      publicKeyStartsWith: publicKey.slice(0, 40),
      publicKeyEndsWith: publicKey.slice(-40),
    });

    return false;
  }
}

export async function queryAlipayTrade(outTradeNo: string) {
  const { appId, privateKey, privateKeyPkcs8Fallback, gateway } =
    getAlipayConfig();

  const params: Record<string, string> = {
    app_id: appId,
    method: "alipay.trade.query",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTimestamp(),
    version: "1.0",
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
    }),
  };

  const sign = signAlipayParams(params, privateKey, privateKeyPkcs8Fallback);
  const searchParams = new URLSearchParams({
    ...params,
    sign,
  });

  const response = await fetch(`${gateway}?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Alipay trade query failed with status ${response.status}: ${rawText.slice(
        0,
        500
      )}`
    );
  }

  let parsed: {
    alipay_trade_query_response?: {
      code?: string;
      msg?: string;
      sub_code?: string;
      sub_msg?: string;
      trade_status?: string;
      trade_no?: string;
      out_trade_no?: string;
      total_amount?: string;
    };
  };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Alipay trade query returned non-JSON: ${rawText.slice(0, 500)}`);
  }

  const queryResponse = parsed.alipay_trade_query_response;

  if (!queryResponse) {
    throw new Error("Alipay trade query response was missing.");
  }

  if (queryResponse.code !== "10000") {
    return {
      tradeStatus: null,
      tradeNo: null,
      outTradeNo,
      totalAmount: null,
      raw: parsed,
    } satisfies AlipayTradeQueryResult;
  }

  return {
    tradeStatus: queryResponse.trade_status || null,
    tradeNo: queryResponse.trade_no || null,
    outTradeNo: queryResponse.out_trade_no || outTradeNo,
    totalAmount: queryResponse.total_amount || null,
    raw: parsed,
  } satisfies AlipayTradeQueryResult;
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
    <form
      id="alipay-submit-form"
      method="get"
      accept-charset="utf-8"
      action="${escapeHtml(gateway)}"
    >
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
