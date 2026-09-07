import { NextRequest, NextResponse } from 'next/server';

// Simple HTTP Basic Auth gate for the whole dashboard.
// Credentials come from env vars — set DASHBOARD_USERNAME and DASHBOARD_PASSWORD
// in Vercel → Settings → Environment Variables. Never hardcode them here.

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPass) {
    // Fail closed: if env vars aren't set, block access rather than leave it open.
    return new NextResponse('Dashboard auth is not configured.', { status: 500 });
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pass] = Buffer.from(authValue, 'base64').toString().split(':');

    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
