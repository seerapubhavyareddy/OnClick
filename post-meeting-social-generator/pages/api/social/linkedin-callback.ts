// pages/api/social/linkedin-callback.ts - CUSTOM callback (separate from NextAuth)
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🟦 LinkedIn callback received')
    console.log('🟦 Query params:', req.query)
    console.log('🟦 Environment:', process.env.NODE_ENV)
    console.log('🟦 NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
    console.log('🟦 VERCEL_URL:', process.env.VERCEL_URL)

    // Import URL helper
    const { getBaseUrl, getLinkedInCallbackUrl } = await import('../../../lib/url-helper')
    const baseUrl = getBaseUrl()
    const callbackUrl = getLinkedInCallbackUrl()

    const { code, state, error } = req.query

    if (error) {
      console.error('🟦 LinkedIn OAuth error:', error)
      return res.redirect(`${baseUrl}/settings?error=linkedin_failed&details=${encodeURIComponent(error as string)}`)
    }

    if (!code || !state) {
      console.error('🟦 Missing code or state')
      return res.redirect(`${baseUrl}/settings?error=missing_params`)
    }

    // Parse state
    let stateData
    try {
      stateData = JSON.parse(state as string)
      console.log('🟦 Parsed state:', stateData)
    } catch (parseError) {
      console.error('🟦 Invalid state JSON:', state)
      return res.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    const { userId, action, platform } = stateData

    if (action !== 'connect_social' || platform !== 'linkedin' || !userId) {
      console.error('🟦 Invalid state data:', stateData)
      return res.redirect(`${baseUrl}/settings?error=invalid_request`)
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('🟦 User not found:', userId)
      return res.redirect(`${baseUrl}/settings?error=user_not_found`)
    }

    console.log('🟦 Exchanging code for tokens...')

    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: callbackUrl, // Use the helper function
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('🟦 LinkedIn token error:', tokenResponse.status, errorText)
      return res.redirect(`${baseUrl}/settings?error=token_failed&status=${tokenResponse.status}`)
    }

    const tokens = await tokenResponse.json()
    console.log('🟦 Tokens received:', { 
      hasAccessToken: !!tokens.access_token,
      expiresIn: tokens.expires_in 
    })

    // Get user info from LinkedIn
    console.log('🟦 Fetching LinkedIn user info...')
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('🟦 LinkedIn userinfo error:', userResponse.status, errorText)
      return res.redirect(`${baseUrl}/settings?error=userinfo_failed&status=${userResponse.status}`)
    }

    const linkedinUser = await userResponse.json()
    console.log('🟦 LinkedIn user received:', {
      sub: linkedinUser.sub,
      name: linkedinUser.name,
      email: linkedinUser.email
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
        scope: 'openid profile email', // Store the scope we requested
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

    console.log('✅ LinkedIn connected successfully for user:', user.email)
    console.log('✅ Social account ID:', socialAccount.id)

    // Redirect to settings with success
    return res.redirect(`${baseUrl}/settings?connected=linkedin&email=${encodeURIComponent(linkedinUser.email)}`)

  } catch (error) {
    console.error('❌ LinkedIn callback error:', error)
    
    // Import URL helper for error redirect
    const { getBaseUrl } = await import('../../../lib/url-helper')
    const baseUrl = getBaseUrl()
    
    return res.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}