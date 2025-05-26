// src/app/api/migrate/google-account/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'
import { multipleAccountCalendarService } from '../../../../../lib/multiple-calendar-service'

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

    console.log(`🔄 Migrating Google account for user: ${user.email}`)

    // Check if already migrated
    const existingGoogleAccounts = await prisma.googleAccount.count({
      where: { userId: user.id }
    })

    if (existingGoogleAccounts > 0) {
      return NextResponse.json({ 
        message: 'Google account already migrated',
        count: existingGoogleAccounts 
      })
    }

    // Get the Google account from NextAuth Account table
    const googleAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google'
      }
    })

    if (!googleAccount || !googleAccount.access_token) {
      return NextResponse.json({ 
        error: 'No Google account found to migrate' 
      }, { status: 404 })
    }

    // Migrate to GoogleAccount table
    await multipleAccountCalendarService.addGoogleAccount(user.id, {
      email: user.email!,
      accessToken: googleAccount.access_token,
      refreshToken: googleAccount.refresh_token || undefined,
      expiresAt: googleAccount.expires_at ? new Date(googleAccount.expires_at * 1000) : undefined,
      name: user.name || undefined,
      image: user.image || undefined,
      accountId: googleAccount.providerAccountId!
    })

    console.log(`✅ Migrated Google account: ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Google account migrated successfully' 
    })

  } catch (error) {
    console.error('Error migrating Google account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}