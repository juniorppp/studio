
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/config';
import { verifyUserToken } from '@/lib/authUtils';
import type { UserJWTPayload } from '@/types'; // Ensure this line is present

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register'];

  // Allow access to public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // For Genkit dev endpoint, allow if not in production
  if (pathname.startsWith('/api/genkit') && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }


  let session: UserJWTPayload | null = null;
  if (token) {
    try {
        session = await verifyUserToken(token); // Now async
    } catch (e) {
        console.error("Token verification error in middleware", e);
    }
  }


  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // If session exists and trying to access login/register, redirect to home
  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /images (public images)
     * - /api/genkit (if allowing in dev)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|api/genkit/DEFAULT_FLOW_RUNNER_ADDRESS).*)',
  ],
};
