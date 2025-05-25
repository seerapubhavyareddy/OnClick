// src/app/api/ai/generate/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'
import { aiContentService } from '../../../../../lib/ai-content-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { meetingId, type, platform, customPrompt } = await request.json()

    if (!meetingId || !type) {
      return NextResponse.json({ 
        error: 'Meeting ID and type are required' 
      }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the meeting with transcript
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        userId: user.id
      }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (!meeting.transcriptText) {
      return NextResponse.json({ 
        error: 'No transcript available for this meeting' 
      }, { status: 400 })
    }

    // Extract attendees from meeting data
    const attendees = Array.isArray(meeting.attendees) 
      ? meeting.attendees.map((a: any) => a.displayName || a.email).filter(Boolean)
      : []

    let generatedContent: string

    if (type === 'social_post') {
      if (!platform) {
        return NextResponse.json({ 
          error: 'Platform is required for social posts' 
        }, { status: 400 })
      }

      generatedContent = await aiContentService.generateSocialPost({
        transcript: meeting.transcriptText,
        meetingTitle: meeting.title,
        attendees,
        platform: platform as 'linkedin' | 'facebook',
        customPrompt
      })
    } else if (type === 'summary') {
      generatedContent = await aiContentService.summarizeTranscript(
        meeting.transcriptText,
        meeting.title
      )
    } else {
      return NextResponse.json({ 
        error: 'Invalid type. Use: social_post or summary' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      content: generatedContent,
      meetingTitle: meeting.title,
      type,
      platform: platform || null
    })

  } catch (error: any) {
    console.error('Error generating content:', error)
    return NextResponse.json({ 
      error: 'Failed to generate content',
      details: error.message 
    }, { status: 500 })
  }
}