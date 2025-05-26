// src/app/api/social/mock-connect/route.ts - CREATE THIS FILE
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

    if (!platform || platform !== 'facebook') {
      return NextResponse.json({ 
        error: 'Invalid platform. Only Facebook demo connections are supported here.' 
      }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create mock social account connection ONLY for Facebook (demo purposes)
    // LinkedIn uses real OAuth through NextAuth
    if (platform !== 'facebook') {
      return NextResponse.json({ 
        error: 'Only Facebook demo connections are supported. LinkedIn uses real OAuth.' 
      }, { status: 400 })
    }
    const mockProfileData = {
      name: session.user.name || `Demo ${platform} User`,
      email: session.user.email,
      image: session.user.image,
      platformId: `demo_${platform}_${Date.now()}`,
      connectedAt: new Date().toISOString(),
      isDemoAccount: true
    }

    const mockAccessToken = `demo_${platform}_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store the mock connection
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId: user.id,
          platform: platform
        }
      },
      update: {
        platformId: mockProfileData.platformId,
        accessToken: mockAccessToken,
        profileData: mockProfileData,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        platform: platform,
        platformId: mockProfileData.platformId,
        accessToken: mockAccessToken,
        profileData: mockProfileData
      }
    })

    console.log(`✅ Mock ${platform} account connected for user: ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: `Demo ${platform} account connected successfully`,
      profileData: mockProfileData,
      isDemoConnection: true
    })

  } catch (error) {
    console.error('Error creating mock social connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}