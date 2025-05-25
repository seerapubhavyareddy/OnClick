// src/app/api/polling/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../pages/api/auth/[...nextauth]'
import { pollingService } from '../../../../lib/polling-service'
import { prisma } from '../../../../lib/prisma'

// GET - Check polling status and bot statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-start polling service when first accessed
    await pollingService.startPolling()

    // Get polling statistics
    const activeBots = await prisma.meeting.count({
      where: {
        recallBotId: { not: null },
        recallBotStatus: {
          in: ['ready', 'joining_call', 'in_waiting_room', 'in_call_not_recording', 'in_call_recording']
        }
      }
    })

    const completedBots = await prisma.meeting.count({
      where: {
        recallBotId: { not: null },
        recallBotStatus: 'completed'
      }
    })

    const failedBots = await prisma.meeting.count({
      where: {
        recallBotId: { not: null },
        recallBotStatus: {
          in: ['failed', 'processing_failed', 'no_transcript']
        }
      }
    })

    // Get recent bot activity
    const recentActivity = await prisma.meeting.findMany({
      where: {
        recallBotId: { not: null },
        lastPolledAt: { not: null }
      },
      select: {
        id: true,
        title: true,
        recallBotId: true,
        recallBotStatus: true,
        lastPolledAt: true,
        completedAt: true
      },
      orderBy: {
        lastPolledAt: 'desc'
      },
      take: 10
    })

    return NextResponse.json({
      activeBots,
      completedBots,
      failedBots,
      recentActivity,
      totalBots: activeBots + completedBots + failedBots
    })

  } catch (error) {
    console.error('Error getting polling status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Start polling service
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    if (action === 'start') {
      await pollingService.startPolling()
      return NextResponse.json({ 
        success: true, 
        message: 'Polling service started',
        timestamp: new Date().toISOString()
      })
    } else if (action === 'stop') {
      pollingService.stopPolling()
      return NextResponse.json({ 
        success: true, 
        message: 'Polling service stopped',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error managing polling:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}