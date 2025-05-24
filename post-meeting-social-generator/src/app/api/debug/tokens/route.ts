// src/app/api/debug/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'

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

    // Get the Google account with tokens
    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
      },
    })

    return NextResponse.json({
      hasAccount: !!account,
      hasAccessToken: !!account?.access_token,
      hasRefreshToken: !!account?.refresh_token,
      accessTokenLength: account?.access_token?.length || 0,
      refreshTokenLength: account?.refresh_token?.length || 0,
      expiresAt: account?.expires_at,
      scope: account?.scope,
      tokenType: account?.token_type,
    })
  } catch (error) {
    console.error('Debug tokens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}