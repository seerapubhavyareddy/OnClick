// src/app/api/social/disconnect/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { platform } = await request.json()

    if (!platform || (platform !== 'linkedin' && platform !== 'facebook')) {
      return NextResponse.json({ 
        error: 'Invalid platform. Use "linkedin" or "facebook"' 
      }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete the social account connection
    const deletedAccount = await prisma.socialAccount.deleteMany({
      where: {
        userId: user.id,
        platform: platform
      }
    })

    if (deletedAccount.count === 0) {
      return NextResponse.json({ 
        error: 'Social account connection not found' 
      }, { status: 404 })
    }

    console.log(`🔌 Disconnected ${platform} account for user: ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: `${platform} account disconnected successfully` 
    })

  } catch (error) {
    console.error('Error disconnecting social account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}