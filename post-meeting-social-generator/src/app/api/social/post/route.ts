// src/app/api/social/post/route.ts
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

    const { platform, content, meetingId } = await request.json()

    if (!platform || !content) {
      return NextResponse.json({ 
        error: 'Platform and content are required' 
      }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has connected this social platform
    const socialAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: platform
        }
      }
    })

    if (!socialAccount) {
      return NextResponse.json({ 
        error: `${platform} account not connected. Please connect in settings first.` 
      }, { status: 400 })
    }

    console.log(`📱 Attempting to post to ${platform.toUpperCase()}...`)

    // For demo purposes, we'll simulate posting since real LinkedIn API posting 
    // requires additional approvals and business verification
    if (platform === 'linkedin') {
      // Simulate LinkedIn posting
      await simulateLinkedInPost(socialAccount.accessToken, content)
    } else if (platform === 'facebook') {
      // Simulate Facebook posting  
      await simulateFacebookPost(socialAccount.accessToken, content)
    } else {
      return NextResponse.json({ 
        error: `Posting to ${platform} is not supported yet` 
      }, { status: 400 })
    }

    // Simulate posting delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Mock successful post response
    const mockPostId = `demo_post_${platform}_${Date.now()}`
    const mockPostUrl = platform === 'linkedin' 
      ? `https://linkedin.com/posts/${mockPostId}`
      : `https://facebook.com/posts/${mockPostId}`

    // Log the "post" for demo purposes
    console.log(`📱 Mock ${platform.toUpperCase()} Post Successful:`)
    console.log(`Content: ${content.substring(0, 100)}...`)
    console.log(`Post ID: ${mockPostId}`)
    console.log(`URL: ${mockPostUrl}`)

    return NextResponse.json({ 
      success: true, 
      message: `Demo: Post would be published to ${platform}!`,
      postId: mockPostId,
      postUrl: mockPostUrl,
      platform: platform,
      timestamp: new Date().toISOString(),
      demo: true,
      note: 'This is a demonstration. In production with proper API approval, this would post to your actual LinkedIn account.',
      realImplementation: 'Requires LinkedIn Marketing Developer Platform approval for posting permissions.'
    })

  } catch (error) {
    console.error('Error posting to social media:', error)
    return NextResponse.json({ 
      error: 'Failed to post to social media',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Simulate LinkedIn posting (in production, this would use LinkedIn's API)
async function simulateLinkedInPost(accessToken: string, content: string) {
  console.log('🟦 Simulating LinkedIn post...')
  console.log('Access token length:', accessToken.length)
  console.log('Content preview:', content.substring(0, 50) + '...')
  
  // In production, you would make an actual API call to LinkedIn:
  // const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     author: `urn:li:person:${linkedInPersonId}`,
  //     lifecycleState: 'PUBLISHED',
  //     specificContent: {
  //       'com.linkedin.ugc.ShareContent': {
  //         shareCommentary: { text: content },
  //         shareMediaCategory: 'NONE'
  //       }
  //     },
  //     visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  //   })
  // })
  
  return { success: true, platform: 'linkedin' }
}

// Simulate Facebook posting (in production, this would use Facebook's Graph API)
async function simulateFacebookPost(accessToken: string, content: string) {
  console.log('📘 Simulating Facebook post...')
  console.log('Access token length:', accessToken.length)
  console.log('Content preview:', content.substring(0, 50) + '...')
  
  // In production, you would make an actual API call to Facebook:
  // const response = await fetch(`https://graph.facebook.com/me/feed`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     message: content
  //   })
  // })
  
  return { success: true, platform: 'facebook' }
}