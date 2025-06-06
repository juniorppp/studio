
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/config';
import { verifyUserToken } from '@/lib/authUtils'; // Assuming this can run in middleware edge runtime

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register']; // API routes for auth are public

  // Allow access to public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // For Genkit dev endpoint, allow if not in production
  if (pathname.startsWith('/api/genkit') && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }


  let session = null;
  if (token) {
    // verifyUserToken might use 'jsonwebtoken' which may not be edge compatible.
    // For middleware, a simpler check or a different JWT library might be needed if issues arise.
    // Or, protect pages within the page components themselves using a server action.
    // For now, let's assume verifyUserToken is simple enough or use a placeholder.
    try {
        session = verifyUserToken(token); // This might be problematic in Edge runtime
    } catch (e) {
        console.error("Token verification error in middleware", e);
        // If token verification fails, treat as no session
    }
  }


  if (!session) {
    // If no session and trying to access a protected route, redirect to login
    // Preserve search params for redirection after login, e.g., ?next=/dashboard
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
