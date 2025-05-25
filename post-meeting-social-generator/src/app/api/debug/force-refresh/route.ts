// src/app/api/debug/force-refresh/route.ts
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

    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
      },
    })

    if (!account?.refresh_token) {
      return NextResponse.json({ error: 'No refresh token found' }, { status: 400 })
    }

    console.log('🔄 Force refreshing token for user:', user.email)

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()

    // Update the stored tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
      },
    })

    console.log('✅ Token force refreshed successfully')

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      newExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null
    })

  } catch (error: unknown) {
    console.error('❌ Error force refreshing token:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Failed to refresh token',
      details: message 
    }, { status: 500 })
  }
}