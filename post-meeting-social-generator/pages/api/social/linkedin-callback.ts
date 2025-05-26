// pages/api/social/linkedin-callback.ts - DEBUG VERSION
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🟦 ===== LinkedIn Callback Started =====')
    console.log('🟦 Timestamp:', new Date().toISOString())
    console.log('🟦 Environment:', process.env.NODE_ENV)
    console.log('🟦 Host:', req.headers.host)
    console.log('🟦 User-Agent:', req.headers['user-agent'])
    console.log('🟦 Query params:', JSON.stringify(req.query, null, 2))

    // Import URL helper
    const { getBaseUrl } = await import('../../../lib/url-helper')
    const baseUrl = getBaseUrl()
    
    console.log('🟦 Base URL determined:', baseUrl)

    const { code, state, error } = req.query

    if (error) {
      console.error('🟦 LinkedIn OAuth error received:', error)
      const errorUrl = `${baseUrl}/settings?error=linkedin_failed&details=${encodeURIComponent(error as string)}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      // Set cache headers to prevent caching
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      
      return res.redirect(302, errorUrl)
    }

    if (!code || !state) {
      console.error('🟦 Missing required parameters - code:', !!code, 'state:', !!state)
      const errorUrl = `${baseUrl}/settings?error=missing_params`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    // Parse state
    let stateData
    try {
      stateData = JSON.parse(state as string)
      console.log('🟦 State parsed successfully:', JSON.stringify(stateData, null, 2))
    } catch (parseError) {
      console.error('🟦 State parsing failed:', parseError)
      console.error('🟦 Raw state:', state)
      const errorUrl = `${baseUrl}/settings?error=invalid_state`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    const { userId, action, platform } = stateData

    if (action !== 'connect_social' || platform !== 'linkedin' || !userId) {
      console.error('🟦 Invalid state data received:', stateData)
      const errorUrl = `${baseUrl}/settings?error=invalid_request`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    // Verify user exists
    console.log('🟦 Looking up user with ID:', userId)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('🟦 User not found in database:', userId)
      const errorUrl = `${baseUrl}/settings?error=user_not_found`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    console.log('🟦 User found:', { email: user.email, id: user.id })
    console.log('🟦 Starting token exchange...')

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/social/linkedin-callback`
    console.log('🟦 Using redirect URI:', redirectUri)
    
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    })

    console.log('🟦 Token request body:', tokenRequestBody.toString())
    console.log('🟦 Making token request to LinkedIn...')

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Meeting-Social-Generator/1.0'
      },
      body: tokenRequestBody.toString(),
    })

    console.log('🟦 Token response status:', tokenResponse.status)
    console.log('🟦 Token response headers:', Object.fromEntries(tokenResponse.headers.entries()))
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('🟦 LinkedIn token error response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText
      })
      const errorUrl = `${baseUrl}/settings?error=token_failed&status=${tokenResponse.status}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    const tokens = await tokenResponse.json()
    console.log('🟦 Tokens received successfully:', { 
      hasAccessToken: !!tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    })

    // Get user info from LinkedIn
    console.log('🟦 Fetching LinkedIn user info...')
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'Meeting-Social-Generator/1.0'
      },
    })

    console.log('🟦 LinkedIn userinfo response status:', userResponse.status)

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('🟦 LinkedIn userinfo error:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        body: errorText
      })
      const errorUrl = `${baseUrl}/settings?error=userinfo_failed&status=${userResponse.status}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.redirect(302, errorUrl)
    }

    const linkedinUser = await userResponse.json()
    console.log('🟦 LinkedIn user received:', {
      sub: linkedinUser.sub,
      name: linkedinUser.name,
      email: linkedinUser.email,
      hasImage: !!linkedinUser.picture,
      fullResponse: JSON.stringify(linkedinUser, null, 2)
    })

    // Store LinkedIn connection
    console.log('🟦 Storing LinkedIn connection in database...')
    
    const socialAccountData = {
      userId: userId,
      platform: 'linkedin',
      platformId: linkedinUser.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: 'openid profile email',
      profileData: {
        name: linkedinUser.name,
        email: linkedinUser.email,
        image: linkedinUser.picture,
        platformId: linkedinUser.sub,
        connectedAt: new Date().toISOString()
      }
    }
    
    console.log('🟦 Social account data to store:', JSON.stringify(socialAccountData, null, 2))
    
    const socialAccount = await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId: userId,
          platform: 'linkedin'
        }
      },
      update: {
        platformId: linkedinUser.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scope: 'openid profile email',
        profileData: socialAccountData.profileData,
        updatedAt: new Date()
      },
      create: socialAccountData
    })

    console.log('✅ LinkedIn connection stored successfully!')
    console.log('✅ Social account record:', {
      id: socialAccount.id,
      platform: socialAccount.platform,
      userId: socialAccount.userId
    })
    console.log('✅ For user:', user.email)

    // Final redirect to settings with success
    const successUrl = `${baseUrl}/settings?connected=linkedin&email=${encodeURIComponent(linkedinUser.email)}&timestamp=${Date.now()}`
    console.log('🟦 Final redirect URL:', successUrl)
    
    // Set headers to prevent caching and ensure fresh redirect
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Location', successUrl)
    
    console.log('🟦 ===== LinkedIn Callback Completed Successfully =====')
    
    return res.status(302).end()

  } catch (error) {
    console.error('❌ ===== LinkedIn Callback Error =====')
    console.error('❌ Error details:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    try {
      const { getBaseUrl } = await import('../../../lib/url-helper')
      const baseUrl = getBaseUrl()
      
      const errorUrl = `${baseUrl}/settings?error=callback_failed&timestamp=${Date.now()}`
      console.log('🟦 Final error redirect URL:', errorUrl)
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Location', errorUrl)
      
      return res.status(302).end()
    } catch (importError) {
      console.error('❌ Failed to import URL helper:', importError)
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}