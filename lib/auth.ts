import crypto from 'crypto';

// Lightweight session token: HMAC-signed, no external JWT library needed.
// Format: base64(username).signature

function getSecret(): string {
  const secret = process.env.DASHBOARD_PASSWORD; // reuse as HMAC secret, simplest option
  if (!secret) throw new Error('DASHBOARD_PASSWORD env var is missing');
  return secret;
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(username).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = 'dashboard_session';
