// lib/url-helper.ts - FIXED with correct production domain
export function getBaseUrl(): string {
  // Force production domain in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://post-meeting-social-generator.vercel.app'
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