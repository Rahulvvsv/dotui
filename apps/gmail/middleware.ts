import { type NextRequest, NextResponse } from 'next/server';

/**
 * Every visitor gets a stable anonymous id (`dotui_uid`) on first contact; the
 * overlay/visual stores key their rows by it, so one person's ✨ edits are
 * theirs alone instead of becoming everyone's UI.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get('dotui_uid')) return NextResponse.next();

  // Mutate the request's cookies too (not just the response's) so this same request's
  // downstream Server Components / Route Handlers see the id via cookies() immediately —
  // otherwise a visitor's very first request would still read/write the 'default' scope.
  const uid = crypto.randomUUID();
  request.cookies.set('dotui_uid', uid);
  const response = NextResponse.next({ request });
  response.cookies.set('dotui_uid', uid, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return response;
}
