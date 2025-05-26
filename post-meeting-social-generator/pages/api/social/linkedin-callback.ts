// pages/api/social/linkedin-callback.ts - FIXED callback with better error handling
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🟦 LinkedIn callback received')
    console.log('🟦 Environment:', process.env.NODE_ENV)
    console.log('🟦 Query params:', req.query)

    // Import URL helper
    const { getBaseUrl } = await import('../../../lib/url-helper')
    const baseUrl = getBaseUrl()
    
    console.log('🟦 Base URL:', baseUrl)

    const { code, state, error } = req.query

    if (error) {
      console.error('🟦 LinkedIn OAuth error:', error)
      const errorUrl = `${baseUrl}/settings?error=linkedin_failed&details=${encodeURIComponent(error as string)}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    if (!code || !state) {
      console.error('🟦 Missing code or state')
      const errorUrl = `${baseUrl}/settings?error=missing_params`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    // Parse state
    let stateData
    try {
      stateData = JSON.parse(state as string)
      console.log('🟦 Parsed state:', stateData)
    } catch (parseError) {
      console.error('🟦 Invalid state JSON:', state, parseError)
      const errorUrl = `${baseUrl}/settings?error=invalid_state`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    const { userId, action, platform } = stateData

    if (action !== 'connect_social' || platform !== 'linkedin' || !userId) {
      console.error('🟦 Invalid state data:', stateData)
      const errorUrl = `${baseUrl}/settings?error=invalid_request`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('🟦 User not found:', userId)
      const errorUrl = `${baseUrl}/settings?error=user_not_found`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    console.log('🟦 User verified:', user.email)
    console.log('🟦 Exchanging code for tokens...')

    // Exchange code for tokens
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: `${baseUrl}/api/social/linkedin-callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    })

    console.log('🟦 Token request body:', tokenRequestBody.toString())

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenRequestBody.toString(),
    })

    console.log('🟦 Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('🟦 LinkedIn token error:', tokenResponse.status, errorText)
      const errorUrl = `${baseUrl}/settings?error=token_failed&status=${tokenResponse.status}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    const tokens = await tokenResponse.json()
    console.log('🟦 Tokens received:', { 
      hasAccessToken: !!tokens.access_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    })

    // Get user info from LinkedIn
    console.log('🟦 Fetching LinkedIn user info...')
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      },
    })

    console.log('🟦 User info response status:', userResponse.status)

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('🟦 LinkedIn userinfo error:', userResponse.status, errorText)
      const errorUrl = `${baseUrl}/settings?error=userinfo_failed&status=${userResponse.status}`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    }

    const linkedinUser = await userResponse.json()
    console.log('🟦 LinkedIn user received:', {
      sub: linkedinUser.sub,
      name: linkedinUser.name,
      email: linkedinUser.email,
      hasImage: !!linkedinUser.picture
    })

    // Store LinkedIn connection
    console.log('🟦 Storing LinkedIn connection in database...')
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
        profileData: {
          name: linkedinUser.name,
          email: linkedinUser.email,
          image: linkedinUser.picture,
          platformId: linkedinUser.sub,
          connectedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      },
      create: {
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
    })

    console.log('✅ LinkedIn connected successfully!')
    console.log('✅ Social account ID:', socialAccount.id)
    console.log('✅ For user:', user.email)

    // Redirect to settings with success - USE 302 redirect explicitly
    const successUrl = `${baseUrl}/settings?connected=linkedin&email=${encodeURIComponent(linkedinUser.email)}`
    console.log('🟦 Redirecting to success URL:', successUrl)
    
    return res.redirect(302, successUrl)

  } catch (error) {
    console.error('❌ LinkedIn callback error:', error)
    
    try {
      // Import URL helper for error redirect
      const { getBaseUrl } = await import('../../../lib/url-helper')
      const baseUrl = getBaseUrl()
      
      const errorUrl = `${baseUrl}/settings?error=callback_failed`
      console.log('🟦 Redirecting to error URL:', errorUrl)
      return res.redirect(302, errorUrl)
    } catch (importError) {
      console.error('❌ Failed to import URL helper:', importError)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}