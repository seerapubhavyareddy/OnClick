// src/app/api/meetings/past/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'

// Define the meeting type from database
interface PastMeetingFromDB {
  id: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date | null
  attendees: any
  platform: string | null
  recallBotId: string | null
  recallBotStatus: string | null
  transcriptText: string | null
  transcript: any
  videoUrl: string | null
  completedAt: Date | null
  noteTakerEnabled: boolean
}

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

    // Get past meetings (those that have ended or been completed)
    const pastMeetings = await prisma.meeting.findMany({
      where: {
        userId: user.id,
        OR: [
          // Meetings that have completed with transcripts
          { recallBotStatus: 'completed' },
          // Meetings that ended in the past (even without bots)
          { 
            endTime: { lt: new Date() },
            startTime: { lt: new Date() }
          }
        ]
      },
      orderBy: {
        startTime: 'desc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        attendees: true,
        platform: true,
        recallBotId: true,
        recallBotStatus: true,
        transcriptText: true,
        transcript: true,
        videoUrl: true,
        completedAt: true,
        noteTakerEnabled: true
      }
    })

    // Format the response with proper typing
    const formattedMeetings = pastMeetings.map((meeting: PastMeetingFromDB) => ({
      ...meeting,
      hasTranscript: !!meeting.transcriptText,
      hasVideo: !!meeting.videoUrl,
      attendeeCount: Array.isArray(meeting.attendees) ? meeting.attendees.length : 0,
      duration: meeting.endTime ? 
        Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)) : 
        null, // duration in minutes
    }))

    return NextResponse.json(formattedMeetings)

  } catch (error) {
    console.error('Error fetching past meetings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET specific meeting with full transcript
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { meetingId } = await request.json()

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get specific meeting with full details
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        userId: user.id
      }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    return NextResponse.json(meeting)

  } catch (error) {
    console.error('Error fetching meeting details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}