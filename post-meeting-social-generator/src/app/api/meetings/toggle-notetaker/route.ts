// src/app/api/meetings/toggle-notetaker/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'
import { getCalendarClientForUser } from '../../../../../lib/google-calendar'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, enabled } = await request.json()

    if (!eventId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get calendar client to fetch event details
    const calendarClient = await getCalendarClientForUser(user.id)
    
    if (!calendarClient) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    // Fetch the specific event to get meeting details
    const events = await calendarClient.getUpcomingEvents(100)
    const event = events.find(e => e.id === eventId)

    if (!event) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
    }

    // Check if event has a valid meeting URL
    if (!event.meetingUrl && enabled) {
      return NextResponse.json({ 
        error: 'Cannot enable note taker: No meeting URL found in calendar event' 
      }, { status: 400 })
    }

    // Find or create meeting record
    const meeting = await prisma.meeting.upsert({
      where: {
        userId_calendarEventId: {
          userId: user.id,
          calendarEventId: eventId,
        }
      },
      update: {
        noteTakerEnabled: enabled,
        // Update meeting details in case they changed
        title: event.summary,
        startTime: new Date(event.start.dateTime),
        endTime: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
        meetingUrl: event.meetingUrl,
        platform: event.platform,
        attendees: event.attendees || [],
      },
      create: {
        userId: user.id,
        calendarEventId: eventId,
        title: event.summary,
        description: event.description,
        startTime: new Date(event.start.dateTime),
        endTime: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
        attendees: event.attendees || [],
        meetingUrl: event.meetingUrl,
        platform: event.platform,
        noteTakerEnabled: enabled,
      }
    })

    // TODO: Phase 3 - Schedule/cancel Recall.ai bot here
    // if (enabled && event.meetingUrl) {
    //   // Schedule Recall bot for this meeting
    //   console.log(`Would schedule Recall bot for meeting: ${event.summary}`)
    // } else if (!enabled && meeting.recallBotId) {
    //   // Cancel/disable bot
    //   console.log(`Would cancel Recall bot for meeting: ${event.summary}`)
    // }

    return NextResponse.json({ 
      success: true, 
      enabled,
      meetingId: meeting.id,
      hasValidUrl: !!event.meetingUrl,
      platform: event.platform,
      message: enabled 
        ? `Note taker enabled for "${event.summary}"` 
        : `Note taker disabled for "${event.summary}"`
    })
  } catch (error) {
    console.error('Error toggling note taker:', error)
    return NextResponse.json(
      { error: 'Failed to toggle note taker' }, 
      { status: 500 }
    )
  }
}