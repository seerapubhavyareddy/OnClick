// middleware.ts (put this in your project root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Remove the app-initializer import that was causing Edge Runtime issues

export function middleware(request: NextRequest) {
  // Simple middleware without Prisma operations
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match API routes
    '/api/:path*',
  ],
}