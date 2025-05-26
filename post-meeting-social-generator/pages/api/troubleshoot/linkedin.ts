// pages/api/troubleshoot/linkedin.ts - LinkedIn troubleshooting
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 LinkedIn Troubleshooting Started')
  
  try {
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      config: {
        hasClientId: !!process.env.LINKEDIN_CLIENT_ID,
        hasClientSecret: !!process.env.LINKEDIN_CLIENT_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        clientId: process.env.LINKEDIN_CLIENT_ID?.substring(0, 8) + '...',
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
      tests: [] as any[]
    }
    
    // Test 1: Check LinkedIn's well-known configuration
    try {
      console.log('🧪 Testing LinkedIn well-known configuration...')
      const wellKnownResponse = await fetch('https://www.linkedin.com/oauth/.well-known/openid-configuration')
      const wellKnownData = wellKnownResponse.ok ? await wellKnownResponse.json() : null
      
      results.tests.push({
        name: 'LinkedIn Well-Known Config',
        success: wellKnownResponse.ok,
        status: wellKnownResponse.status,
        issuer: wellKnownData?.issuer,
        authorizationEndpoint: wellKnownData?.authorization_endpoint,
        tokenEndpoint: wellKnownData?.token_endpoint,
        userinfoEndpoint: wellKnownData?.userinfo_endpoint,
        supportedScopes: wellKnownData?.scopes_supported
      })
    } catch (error) {
      results.tests.push({
        name: 'LinkedIn Well-Known Config',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: Generate proper OAuth URL
    if (process.env.LINKEDIN_CLIENT_ID && process.env.NEXTAUTH_URL) {
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`)
      authUrl.searchParams.set('scope', 'openid profile email')
      authUrl.searchParams.set('state', 'test-state')
      
      results.tests.push({
        name: 'OAuth URL Generation',
        success: true,
        authUrl: authUrl.toString(),
        redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`,
        note: 'This URL should match what you configured in LinkedIn Developer Console'
      })
    }
    
    // Test 3: Check if we can reach LinkedIn's endpoints
    const endpoints = [
      'https://www.linkedin.com/oauth/v2/authorization',
      'https://www.linkedin.com/oauth/v2/accessToken',
      'https://api.linkedin.com/v2/userinfo'
    ]
    
    for (const endpoint of endpoints) {
      try {
        // Just check if endpoint is reachable (will likely return 400/401 but that's fine)
        const response = await fetch(endpoint)
        results.tests.push({
          name: `Endpoint Reachability: ${endpoint}`,
          success: response.status !== 404, // 404 would be bad, other errors are expected
          status: response.status,
          note: 'Status 400/401 is expected without proper auth'
        })
      } catch (error) {
        results.tests.push({
          name: `Endpoint Reachability: ${endpoint}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Test 4: Manual OAuth flow simulation
    if (req.query.manual === 'true') {
      results.tests.push({
        name: 'Manual OAuth Test',
        success: true,
        testUrl: `${process.env.NEXTAUTH_URL}/api/test/linkedin-oauth`,
        note: 'Visit this URL to test the full OAuth flow manually'
      })
    }
    
    results.tests.push({
      name: 'Troubleshooting Summary',
      success: true,
      recommendations: [
        'Check that your LinkedIn app has "Sign In with LinkedIn using OpenID Connect" approved',
        'Verify redirect URI in LinkedIn console matches exactly: ' + `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`,
        'Ensure your LinkedIn app is not in "Development" mode if testing with different emails',
        'Try clearing browser cookies and localStorage for your domain',
        'Check browser Network tab for detailed OAuth error responses'
      ]
    })
    
    return res.json(results)
    
  } catch (error) {
    console.error('❌ Troubleshooting failed:', error)
    return res.status(500).json({
      error: 'Troubleshooting failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}