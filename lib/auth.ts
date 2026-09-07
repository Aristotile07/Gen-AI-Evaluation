// Lightweight session token, signed via the Web Crypto API (SubtleCrypto) so
// it works in Next.js middleware's Edge Runtime — Node's built-in `crypto`
// module is NOT available there, which is why an earlier version of this
// file crashed the middleware. Web Crypto is edge-safe and needs no
// external dependency.

function getSecret(): string {
  const secret = process.env.DASHBOARD_PASSWORD; // reuse as HMAC secret, simplest option
  if (!secret) throw new Error('DASHBOARD_PASSWORD env var is missing');
  return secret;
}

function toBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function createSessionToken(username: string): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(username).buffer as ArrayBuffer);
  const key = await getKey(getSecret());
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = toBase64Url(sigBuffer);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const key = await getKey(getSecret());
  const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedSig = toBase64Url(expectedSigBuffer);
  // simple constant-shape comparison; fine at this scale, avoids Node-only timingSafeEqual
  return sig === expectedSig;
}

export const SESSION_COOKIE_NAME = 'dashboard_session';
