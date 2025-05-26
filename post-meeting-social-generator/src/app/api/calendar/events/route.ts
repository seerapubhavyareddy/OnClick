// src/app/api/calendar/events/route.ts - Updated for multiple accounts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { multipleAccountCalendarService } from '../../../../../lib/multiple-calendar-service'
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

    try {
      console.log(`📅 Fetching events from all Google accounts for user: ${user.email}`)
      
      // First check if we have any Google accounts
      const googleAccountCount = await prisma.googleAccount.count({
        where: { userId: user.id }
      })
      
      console.log(`🔍 Found ${googleAccountCount} Google accounts in database for user: ${user.id}`)
      
      if (googleAccountCount === 0) {
        console.log(`⚠️ No Google accounts found, falling back to NextAuth Account table`)
        
        // Fallback to original single account approach
        const { getCalendarClientForUser } = await import('../../../../../lib/google-calendar')
        const calendarClient = await getCalendarClientForUser(user.id)
        
        if (!calendarClient) {
          return NextResponse.json({ 
            error: 'Google Calendar not connected. Please sign in again to refresh permissions.' 
          }, { status: 400 })
        }
        
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
          accountInfo: {
            email: user.email,
            name: user.name
          }
        }))

        return NextResponse.json(enhancedEvents)
      }
      
      // Get events from all connected Google accounts
      const events = await multipleAccountCalendarService.getAllCalendarEvents(user.id)
      
      console.log(`✅ Got ${events.length} events from all Google accounts`)
      
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
        // Add account information for display
        accountInfo: {
          email: event.accountEmail,
          name: event.accountName
        }
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

    const events = await multipleAccountCalendarService.getAllCalendarEvents(user.id)
    
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