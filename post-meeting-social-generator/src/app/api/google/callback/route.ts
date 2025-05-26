// src/app/api/google/callback/route.ts - FIXED for production
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { multipleAccountCalendarService } from '../../../../../lib/multiple-calendar-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // FIXED: Determine base URL properly for production
    const baseUrl = process.env.NEXTAUTH_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'https://post-meeting-social-generator.vercel.app')
    
    console.log(`🔄 Google callback processing with base URL: ${baseUrl}`)

    // Parse state to get user info and redirect URL
    let stateData
    let redirectBase = baseUrl
    
    try {
      if (state) {
        stateData = JSON.parse(state)
        // Use the redirectUrl from state if available, otherwise use baseUrl
        if (stateData.redirectUrl) {
          redirectBase = stateData.redirectUrl
        }
      }
    } catch (parseError) {
      console.error('Invalid state parameter:', parseError)
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(`${redirectBase}/settings?error=oauth_failed`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectBase}/settings?error=missing_params`)
    }

    const { userId, action } = stateData || {}

    if (action !== 'add_account' || !userId) {
      return NextResponse.redirect(`${redirectBase}/settings?error=invalid_request`)
    }

    // FIXED: Use the correct callback URL for production
    const callbackUrl = `${baseUrl}/api/google/callback`
    
    console.log(`🔧 Using callback URL: ${callbackUrl}`)

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return NextResponse.redirect(`${redirectBase}/settings?error=no_email`)
    }

    console.log(`🔍 Google account info retrieved for: ${userInfo.email}`)

    // Add the additional Google account
    await multipleAccountCalendarService.addGoogleAccount(userId, {
      email: userInfo.email,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      name: userInfo.name || undefined,
      image: userInfo.picture || undefined,
      accountId: userInfo.id!
    })

    console.log(`✅ Additional Google account added: ${userInfo.email}`)

    return NextResponse.redirect(`${redirectBase}/settings?connected=google&email=${encodeURIComponent(userInfo.email)}`)

  } catch (error) {
    console.error('Error in Google callback:', error)
    // FIXED: Use proper fallback URL
    const fallbackUrl = process.env.NEXTAUTH_URL || 'https://post-meeting-social-generator.vercel.app'
    return NextResponse.redirect(`${fallbackUrl}/settings?error=callback_failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`)
  }
}