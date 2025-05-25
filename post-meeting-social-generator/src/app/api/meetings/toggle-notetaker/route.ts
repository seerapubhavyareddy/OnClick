// src/app/api/meetings/toggle-notetaker/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { prisma } from '../../../../../lib/prisma'
import { getCalendarClientForUser } from '../../../../../lib/google-calendar'
import { recallClient } from '../../../../../lib/recall-client'

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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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

    // Handle Recall.ai bot scheduling
    if (enabled && event.meetingUrl) {
      try {
        console.log(`🤖 Scheduling Recall bot for meeting: ${event.summary}`)
        
        // Calculate join time (5 minutes before meeting starts)
        const meetingStart = new Date(event.start.dateTime)
        const joinTime = new Date(meetingStart.getTime() - 5 * 60 * 1000) // 5 minutes early
        
        // Create Recall bot
        const bot = await recallClient.createBot({
          meeting_url: event.meetingUrl,
          join_at: joinTime.toISOString(),
          bot_name: `${user.name || 'Assistant'}'s Note Taker`,
          recording_mode: 'speaker_view',
          transcription_options: {
            provider: 'deepgram' // or 'assembly_ai', 'meeting_captions'
          }
        })

        // Get the initial bot status from status_changes
        const initialStatus = bot.status_changes && bot.status_changes.length > 0 
        ? bot.status_changes[bot.status_changes.length - 1]?.code
        : 'ready'

        // Update meeting with bot information
        await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
            recallBotId: bot.id,
            recallBotStatus: initialStatus, // Use status from status_changes
        }
        })

        console.log(`✅ Recall bot scheduled: ${bot.id} for meeting: ${event.summary}`)

        return NextResponse.json({ 
        success: true, 
        enabled,
        meetingId: meeting.id,
        botId: bot.id,
        botStatus: initialStatus, // Return the actual status
        message: `Note taker bot scheduled for "${event.summary}"`
        })
      } catch (error) {
        console.error('❌ Error creating Recall bot:', error)
        
        // Still save the meeting preference even if bot creation fails
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { recallBotStatus: 'failed' }
        })
        
        return NextResponse.json({ 
          success: true, 
          enabled,
          meetingId: meeting.id,
          error: 'Bot scheduling failed, but preference saved',
          message: `Preference saved for "${event.summary}", but bot scheduling failed`
        })
      }
    } else if (!enabled && meeting.recallBotId) {
      try {
        console.log(`🗑️ Cancelling Recall bot: ${meeting.recallBotId}`)
        
        // Try to delete the bot (if it exists and hasn't started yet)
        await recallClient.deleteBot(meeting.recallBotId)
        
        // Update meeting to remove bot info
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotId: null,
            recallBotStatus: 'cancelled',
          }
        })

        console.log(`✅ Recall bot cancelled for meeting: ${event.summary}`)
        
      } catch (error) {
        console.error('❌ Error cancelling Recall bot:', error)
        // Don't fail the request if bot deletion fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      enabled,
      meetingId: meeting.id,
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