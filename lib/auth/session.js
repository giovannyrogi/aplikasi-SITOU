const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "sitou_session";
export const DEFAULT_SESSION_TTL_MINUTES = 60;

const encodeBase64Url = (value) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const getSessionSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET minimal 32 karakter wajib dikonfigurasi.");
  }

  return secret;
};

const getSigningKey = () =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

export const getSessionTtlSeconds = () => {
  const configuredMinutes = Number(process.env.AUTH_SESSION_TTL_MINUTES);
  const minutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_SESSION_TTL_MINUTES;

  return Math.floor(minutes * 60);
};

export async function createSessionToken(session) {
  const encodedPayload = encodeBase64Url(JSON.stringify(session));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));

  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token) {
  if (typeof token !== "string") return null;

  const [encodedPayload, encodedSignature, extraPart] = token.split(".");
  if (!encodedPayload || !encodedSignature || extraPart) return null;

  try {
    const key = await getSigningKey();
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );

    if (!validSignature) return null;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)));
    if (!payload?.userId || !payload?.roleCode || !payload?.expiresAt) return null;
    if (Date.now() >= Number(payload.expiresAt)) return null;

    return payload;
  } catch {
    return null;
  }
}
