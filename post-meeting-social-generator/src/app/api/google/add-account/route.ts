// src/app/api/google/add-account/route.ts - CREATE THIS FILE
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create OAuth2 client for additional account
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/google/callback`
    )

    // Generate authorization URL for additional account
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      prompt: 'consent',
      state: JSON.stringify({ 
        userId: user.id,
        action: 'add_account'
      })
    })

    return NextResponse.json({ 
      success: true,
      authUrl,
      message: 'Redirect to Google to add additional account'
    })

  } catch (error) {
    console.error('Error generating Google auth URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}