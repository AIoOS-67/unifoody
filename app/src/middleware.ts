import { NextRequest, NextResponse } from 'next/server';

const supportedLocales = ['en', 'zh', 'es'];
const defaultLocale = 'en';

// Paths that should NOT be locale-prefixed
const skipPrefixes = [
  '/api/',
  '/_next/',
  '/icons/',
  '/locales/',
  '/manifest',
  '/service-worker',
  '/sw.js',
  '/workbox',
];

function getLocaleFromPath(pathname: string): string | null {
  const segments = pathname.split('/');
  if (segments.length > 1 && supportedLocales.includes(segments[1])) {
    return segments[1];
  }
  return null;
}

function getPreferredLocale(request: NextRequest): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && supportedLocales.includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const preferred = acceptLang
      .split(',')
      .map((l) => l.split(';')[0].trim().split('-')[0]);
    for (const lang of preferred) {
      if (supportedLocales.includes(lang)) return lang;
    }
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public/static paths and files with extensions
  if (
    skipPrefixes.some((p) => pathname.startsWith(p)) ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const pathLocale = getLocaleFromPath(pathname);

  if (pathLocale) {
    // Path already has locale — set cookie and continue
    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', pathLocale, {
      path: '/',
      maxAge: 31536000,
    });
    return response;
  }

  // No locale in path — redirect to preferred locale
  const locale = getPreferredLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  const response = NextResponse.redirect(url);
  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 31536000,
  });
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|locales|manifest|service-worker|sw.js|workbox|.*\\..*).*)',
  ],
};
