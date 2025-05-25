// src/app/api/auth/refresh-tokens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { refreshGoogleTokens } from '../../../../../lib/google-calendar'
import { prisma } from '../../../../../lib/prisma'

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

    // Attempt to refresh the tokens
    const refreshResult = await refreshGoogleTokens(user.id)

    if (refreshResult) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tokens refreshed successfully' 
      })
    } else {
      return NextResponse.json({ 
        error: 'Failed to refresh tokens. Please sign out and sign in again.' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error refreshing tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check token status
export async function GET(request: NextRequest) {
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

    if (!account) {
      return NextResponse.json({ 
        hasAccount: false,
        error: 'No Google account connected' 
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = account.expires_at || 0
    const timeUntilExpiry = expiresAt - now
    const isExpired = timeUntilExpiry <= 0

    return NextResponse.json({
      hasAccount: true,
      hasAccessToken: !!account.access_token,
      hasRefreshToken: !!account.refresh_token,
      expiresAt: account.expires_at,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      isExpired,
      expiresInMinutes: Math.floor(timeUntilExpiry / 60)
    })

  } catch (error) {
    console.error('Error checking token status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}