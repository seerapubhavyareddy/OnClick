// middleware.ts - UPDATED to exclude LinkedIn callback
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Exclude LinkedIn callback from any middleware processing
  if (request.nextUrl.pathname === '/api/social/linkedin-callback') {
    console.log('🟦 Middleware: Allowing LinkedIn callback to pass through')
    return NextResponse.next()
  }
  
  // Exclude other API routes and assets
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next()
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all request paths except for the ones that should be excluded
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}