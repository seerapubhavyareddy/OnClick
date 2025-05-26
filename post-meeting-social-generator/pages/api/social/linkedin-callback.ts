// pages/api/social/linkedin-callback.ts - Handle LinkedIn connections
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, state, error } = req.query

    if (error) {
      console.error('LinkedIn OAuth error:', error)
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_failed`)
    }

    if (!code || !state) {
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=missing_params`)
    }

    // Parse state
    let stateData
    try {
      stateData = JSON.parse(state as string)
    } catch {
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=invalid_state`)
    }

    const { userId, action, platform } = stateData

    if (action !== 'connect_social' || platform !== 'linkedin' || !userId) {
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=invalid_request`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/social/linkedin-callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('LinkedIn token error:', errorText)
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=token_failed`)
    }

    const tokens = await tokenResponse.json()

    // Get user info from LinkedIn
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    if (!userResponse.ok) {
      console.error('LinkedIn userinfo error:', userResponse.status)
      return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=userinfo_failed`)
    }

    const linkedinUser = await userResponse.json()

    // Store LinkedIn connection
    await prisma.socialAccount.upsert({
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
        profileData: {
          name: linkedinUser.name,
          email: linkedinUser.email,
          image: linkedinUser.picture,
          platformId: linkedinUser.sub,
          connectedAt: new Date().toISOString()
        }
      }
    })

    console.log(`✅ LinkedIn connected for posting: ${linkedinUser.email}`)

    // Redirect to settings with success
    return res.redirect(`${process.env.NEXTAUTH_URL}/settings?connected=linkedin&email=${encodeURIComponent(linkedinUser.email)}`)

  } catch (error) {
    console.error('LinkedIn callback error:', error)
    return res.redirect(`${process.env.NEXTAUTH_URL}/settings?error=callback_failed`)
  }
}