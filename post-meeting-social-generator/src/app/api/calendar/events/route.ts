// src/app/api/calendar/events/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { getCalendarClientForUser } from '../../../../../lib/google-calendar'
import { prisma } from '../../../../../lib/prisma'

// Add this interface at the top
interface ExistingMeeting {
  calendarEventId: string | null;
  noteTakerEnabled: boolean;
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

    const calendarClient = await getCalendarClientForUser(user.id)
    
    if (!calendarClient) {
      return NextResponse.json({ 
        error: 'Google Calendar not connected. Please sign in again to refresh permissions.' 
      }, { status: 400 })
    }

    try {
      const events = await calendarClient.getUpcomingEvents(20)
      
      const existingMeetings: ExistingMeeting[] = await prisma.meeting.findMany({
        where: {
          userId: user.id,
          calendarEventId: { in: events.map(e => e.id) }
        },
        select: {
          calendarEventId: true,
          noteTakerEnabled: true,
        }
      })

      const meetingMap = new Map(
        existingMeetings.map((m: ExistingMeeting) => [m.calendarEventId, m.noteTakerEnabled])
      )

      const enhancedEvents = events.map(event => ({
        ...event,
        noteTakerEnabled: meetingMap.get(event.id) || false,
        hasValidMeetingUrl: !!event.meetingUrl,
      }))

      return NextResponse.json(enhancedEvents)
    } catch (calendarError: unknown) {
      console.error('Calendar API error:', calendarError)
      
      return NextResponse.json({ 
        error: 'Failed to fetch calendar events. Please try again.' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in calendar events API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// POST endpoint to refresh calendar events manually
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

    const calendarClient = await getCalendarClientForUser(user.id)
    
    if (!calendarClient) {
      return NextResponse.json({ 
        error: 'Google Calendar not connected' 
      }, { status: 400 })
    }

    const events = await calendarClient.getUpcomingEvents(20)
    
    // Update or create meeting records for events with meeting URLs
    const updatePromises = events
      .filter(event => event.meetingUrl)
      .map(async (event) => {
        return prisma.meeting.upsert({
          where: {
            userId_calendarEventId: {
              userId: user.id,
              calendarEventId: event.id,
            }
          },
          update: {
            title: event.summary,
            startTime: new Date(event.start.dateTime),
            endTime: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
            meetingUrl: event.meetingUrl,
            platform: event.platform,
            attendees: event.attendees || [],
          },
          create: {
            userId: user.id,
            calendarEventId: event.id,
            title: event.summary,
            description: event.description,
            startTime: new Date(event.start.dateTime),
            endTime: event.end?.dateTime ? new Date(event.end.dateTime) : undefined,
            meetingUrl: event.meetingUrl,
            platform: event.platform,
            attendees: event.attendees || [],
            noteTakerEnabled: false,
          },
        })
      })

    await Promise.all(updatePromises)

    return NextResponse.json({ 
      success: true, 
      eventsProcessed: events.length,
      meetingsUpdated: updatePromises.length 
    })
  } catch (error) {
    console.error('Error refreshing calendar events:', error)
    return NextResponse.json(
      { error: 'Failed to refresh calendar events' }, 
      { status: 500 }
    )
  }
}