// src/app/api/google/callback/route.ts - CREATE THIS FILE
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

    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=oauth_failed`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=missing_params`)
    }

    // Parse state to get user info
    let stateData
    try {
      stateData = JSON.parse(state)
    } catch {
      console.error('Invalid state parameter')
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=invalid_state`)
    }

    const { userId, action } = stateData

    if (action !== 'add_account' || !userId) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=invalid_request`)
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/google/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=no_email`)
    }

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

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?connected=google&email=${encodeURIComponent(userInfo.email)}`)

  } catch (error) {
    console.error('Error in Google callback:', error)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=callback_failed`)
  }
}