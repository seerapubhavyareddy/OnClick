// pages/api/debug/linkedin-test.ts - Create this file for debugging
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 LinkedIn Debug Endpoint Called')
  
  try {
    // Check environment variables
    const config = {
      hasClientId: !!process.env.LINKEDIN_CLIENT_ID,
      hasClientSecret: !!process.env.LINKEDIN_CLIENT_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientIdLength: process.env.LINKEDIN_CLIENT_ID?.length || 0,
      secretLength: process.env.LINKEDIN_CLIENT_SECRET?.length || 0,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
    }
    
    console.log('📋 Environment Config:', config)
    
    // Test LinkedIn endpoints
    const tests = []
    
    // Test 1: LinkedIn Well-Known Configuration
    try {
      console.log('🧪 Testing LinkedIn Well-Known Config...')
      const wellKnownResponse = await fetch('https://www.linkedin.com/oauth/.well-known/openid-configuration')
      const wellKnownData = wellKnownResponse.ok ? await wellKnownResponse.json() : null
      
      tests.push({
        name: 'Well-Known Config',
        success: wellKnownResponse.ok,
        status: wellKnownResponse.status,
        data: wellKnownData
      })
    } catch (error) {
      tests.push({
        name: 'Well-Known Config',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: Manual OAuth URL Generation
    if (process.env.LINKEDIN_CLIENT_ID && process.env.NEXTAUTH_URL) {
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`)
      authUrl.searchParams.set('scope', 'profile email openid')
      authUrl.searchParams.set('state', 'test-state-123')
      
      tests.push({
        name: 'Manual Auth URL',
        success: true,
        authUrl: authUrl.toString(),
        redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`
      })
    }
    
    // Test 3: Check if we can reach LinkedIn's userinfo endpoint (will fail without token, but should give 401, not 404)
    try {
      console.log('🧪 Testing LinkedIn UserInfo Endpoint...')
      const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': 'Bearer fake-token-for-testing'
        }
      })
      
      tests.push({
        name: 'UserInfo Endpoint Test',
        success: userinfoResponse.status === 401, // 401 is expected with fake token
        status: userinfoResponse.status,
        expectedStatus: 401,
        note: '401 means endpoint exists, 404 means it doesn\'t'
      })
    } catch (error) {
      tests.push({
        name: 'UserInfo Endpoint Test',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    return res.json({
      timestamp: new Date().toISOString(),
      config,
      tests,
      instructions: {
        step1: 'Check if all config values are present',
        step2: 'Verify Well-Known Config loads successfully',
        step3: 'Use the manual auth URL to test OAuth flow',
        step4: 'Check browser Network tab for actual error details'
      }
    })
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return res.status(500).json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}