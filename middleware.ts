import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and its API route through, otherwise
  // nobody could ever reach the login form to authenticate in the first place.
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  // API routes get a plain 401 JSON response instead of a redirect,
  // since a fetch() call can't follow an HTML redirect meaningfully.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
