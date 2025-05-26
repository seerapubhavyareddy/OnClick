// lib/url-helper.ts - Create this new file for consistent URL handling
export function getBaseUrl(): string {
  // Production
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Explicit production URL
  if (process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'production') {
    return process.env.NEXTAUTH_URL
  }
  
  // Development
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export function getLinkedInCallbackUrl(): string {
  return `${getBaseUrl()}/api/social/linkedin-callback`
}

// Debug helper
export function logUrlInfo() {
  console.log('🌐 URL Info:', {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    baseUrl: getBaseUrl(),
    linkedinCallback: getLinkedInCallbackUrl()
  })
}