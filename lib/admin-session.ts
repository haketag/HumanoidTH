const encoder = new TextEncoder();
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

function validSecret(secret: string | undefined): secret is string {
  return Boolean(secret && encoder.encode(secret).length >= 32);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSessionToken(secret: string | undefined, now = Date.now()) {
  if (!validSecret(secret)) return null;
  const expiresAt = Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = `admin:${expiresAt}`;
  const signature = await crypto.subtle.sign("HMAC", await importSigningKey(secret), encoder.encode(payload));
  return `${expiresAt}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !validSecret(secret)) return false;
  const [expiresAtText, signatureText, extra] = token.split(".");
  if (extra !== undefined || !/^\d{10}$/.test(expiresAtText) || !/^[A-Za-z0-9_-]{43}$/.test(signatureText)) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

  try {
    const key = await importSigningKey(secret);
    return await crypto.subtle.verify("HMAC", key, fromBase64Url(signatureText), encoder.encode(`admin:${expiresAt}`));
  } catch {
    return false;
  }
}
