// src/app/api/social/accounts/route.ts
export const runtime = 'nodejs'

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

    // Get user's social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId: user.id },
      select: {
        platform: true,
        profileData: true,
        createdAt: true,
        expiresAt: true
      }
    })

    return NextResponse.json(socialAccounts)

  } catch (error) {
    console.error('Error fetching social accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}