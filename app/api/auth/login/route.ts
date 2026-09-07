import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return NextResponse.json({ error: 'Dashboard auth is not configured.' }, { status: 500 });
  }

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return res;
}
