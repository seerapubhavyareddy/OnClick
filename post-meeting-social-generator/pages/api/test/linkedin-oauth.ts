// pages/api/test/linkedin-oauth.ts - Manual LinkedIn OAuth test
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Step 1: Redirect to LinkedIn OAuth
    const clientId = process.env.LINKEDIN_CLIENT_ID!
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/test/linkedin-oauth`
    const state = 'manual-test-' + Date.now()
    
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'profile email openid')
    authUrl.searchParams.set('state', state)
    
    // If no code, redirect to LinkedIn
    if (!req.query.code) {
      console.log('🔄 Redirecting to LinkedIn OAuth:', authUrl.toString())
      return res.redirect(authUrl.toString())
    }
    
    // Step 2: Handle callback
    const { code, state: returnedState, error } = req.query
    
    console.log('📨 LinkedIn callback received:', { code: !!code, state: returnedState, error })
    
    if (error) {
      return res.json({ 
        error: 'LinkedIn OAuth Error', 
        details: error,
        query: req.query 
      })
    }
    
    if (!code) {
      return res.json({ 
        error: 'No authorization code received',
        query: req.query 
      })
    }
    
    // Step 3: Exchange code for token
    try {
      console.log('🔄 Exchanging code for token...')
      
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      })
      
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      })
      
      const tokenText = await tokenResponse.text()
      console.log('📨 Token response:', tokenResponse.status, tokenText)
      
      if (!tokenResponse.ok) {
        return res.json({
          error: 'Token exchange failed',
          status: tokenResponse.status,
          response: tokenText
        })
      }
      
      const tokenData = JSON.parse(tokenText)
      
      // Step 4: Get user info
      console.log('🔄 Getting user info...')
      
      const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      })
      
      const userText = await userResponse.text()
      console.log('📨 User info response:', userResponse.status, userText)
      
      if (!userResponse.ok) {
        return res.json({
          error: 'User info request failed',
          status: userResponse.status,
          response: userText,
          tokenReceived: !!tokenData.access_token
        })
      }
      
      const userData = JSON.parse(userText)
      
      return res.json({
        success: true,
        message: 'LinkedIn OAuth flow completed successfully!',
        tokenData: {
          ...tokenData,
          access_token: tokenData.access_token ? '***PRESENT***' : 'MISSING'
        },
        userData,
        steps: [
          '✅ Authorization code received',
          '✅ Token exchange successful',
          '✅ User info retrieved'
        ]
      })
      
    } catch (error) {
      console.error('❌ Manual OAuth test error:', error)
      return res.json({
        error: 'Manual OAuth test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'Method not allowed' })
  }
}