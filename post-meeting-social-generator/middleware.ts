// middleware.ts (put this in your project root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Import the app initializer to start services
import './lib/app-initializer'

export function middleware(request: NextRequest) {
  // The app initializer will automatically start the polling service
  // when this middleware runs (which happens on every request)
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match API routes
    '/api/:path*',
  ],
}