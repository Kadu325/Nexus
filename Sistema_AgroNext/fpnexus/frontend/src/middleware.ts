import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redireciona visitantes sem cookie de sessão para /login. É apenas conveniência de navegação:
 * a validação da sessão e das permissões acontece sempre na API (sistema.md, Fundação).
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('fpx_session');
  const { pathname, search } = req.nextUrl;
  if (!hasSession && pathname !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|brand|favicon.ico|robots.txt).*)'],
};
