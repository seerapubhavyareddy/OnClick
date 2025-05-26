// lib/polling-service.ts - FIXED with reduced frequency and auto-start
import { prisma } from './prisma'
import { recallClient } from './recall-client'
import type { RecallTranscript, TranscriptSegment, TranscriptWord } from './types/transcript'

export class PollingService {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 120000 // 2 minutes (reduced from 60 seconds)
  private readonly MAX_RETRIES = 30 // Reduced retries to avoid spam
  private isPolling = false // Prevent concurrent polling

  async startPolling() {
    if (this.isRunning) {
      console.log('🔄 Polling service already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting Recall.ai polling service (every 2 minutes)')

    // Start polling immediately
    await this.pollActiveBots()

    // Then set up interval
    this.intervalId = setInterval(async () => {
      if (!this.isPolling) {
        await this.pollActiveBots()
      }
    }, this.POLL_INTERVAL)
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    this.isPolling = false
    console.log('⏹️ Polling service stopped')
  }

  // Check if polling is running
  isPollingActive(): boolean {
    return this.isRunning
  }

  private async pollActiveBots() {
    if (this.isPolling) {
      console.log('⏸️ Polling already in progress, skipping...')
      return
    }

    this.isPolling = true
    console.log('🔍 Starting bot polling cycle...')
    
    try {
      // Get active meetings that need polling
      const activeMeetings = await prisma.meeting.findMany({
        where: {
          recallBotId: { not: null },
          OR: [
            {
              recallBotStatus: {
                in: ['ready', 'joining_call', 'in_waiting_room', 'in_call_not_recording', 'in_call_recording']
              }
            },
            { recallBotStatus: null },
            { recallBotStatus: 'unknown' }
          ],
          pollRetries: { lt: this.MAX_RETRIES }
        },
        take: 3, // Reduced to 3 meetings at a time
        orderBy: {
          lastPolledAt: 'asc' // Poll oldest first
        }
      })

      console.log(`🔍 Found ${activeMeetings.length} active bots to poll`)

      if (activeMeetings.length === 0) {
        console.log('✅ No active bots found')
        return
      }

      // Process meetings with longer delays to avoid rate limits
      for (const meeting of activeMeetings) {
        try {
          await this.pollSingleBot(meeting)
          // Longer delay between each bot check (3 seconds)
          await new Promise(resolve => setTimeout(resolve, 3000))
        } catch (error) {
          console.error(`❌ Error polling bot ${meeting.recallBotId}:`, error)
          continue
        }
      }

      // Get summary stats
      const stats = await this.getPollingStats()
      console.log(`📊 Polling stats: ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed`)

    } catch (error) {
      console.error('❌ Error in polling service:', error)
    } finally {
      this.isPolling = false
      console.log('✅ Polling cycle completed')
    }
  }

  private async pollSingleBot(meeting: any) {
    try {
      if (!meeting.recallBotId) return

      console.log(`🤖 Polling bot ${meeting.recallBotId} for meeting: ${meeting.title}`)

      // Get bot status from Recall.ai
      const bot = await recallClient.getBot(meeting.recallBotId)
      
      const latestStatus = bot.status_changes && bot.status_changes.length > 0 
        ? bot.status_changes[bot.status_changes.length - 1]?.code
        : 'unknown'
      
      console.log(`📡 Bot ${meeting.recallBotId} status: ${latestStatus}`)

      // Update meeting with latest bot status
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          recallBotStatus: latestStatus,
          pollRetries: { increment: 1 },
          lastPolledAt: new Date()
        }
      })

      // Check if bot is done and process transcript
      if (latestStatus === 'done' || latestStatus === 'call_ended') {
        console.log(`✅ Bot ${meeting.recallBotId} completed - processing transcript`)
        await this.processCompletedBot(meeting, bot)
      } else {
        console.log(`⏳ Bot ${meeting.recallBotId} still ${latestStatus} - will check again later`)
      }

    } catch (error) {
      console.error(`❌ Error processing bot ${meeting.recallBotId}:`, error)
      
      // Update error status
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          pollRetries: { increment: 1 },
          lastPolledAt: new Date(),
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }

  private async processCompletedBot(meeting: any, bot: any) {
    try {
      console.log(`🎯 Processing completed bot: ${meeting.title}`)

      const transcript = await recallClient.getBotTranscript(meeting.recallBotId)
      
      if (transcript && transcript.length > 0) {
        const transcriptText = this.formatTranscript(transcript)
        
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotStatus: 'completed',
            transcript: transcript,
            transcriptText: transcriptText,
            videoUrl: bot.video_url,
            completedAt: new Date()
          }
        })

        console.log(`✅ Transcript saved for: ${meeting.title} (${transcriptText.length} characters)`)
      } else {
        console.log(`⚠️ No transcript available for: ${meeting.title}`)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotStatus: 'no_transcript',
            completedAt: new Date()
          }
        })
      }

    } catch (error) {
      console.error(`❌ Error processing completed bot:`, error)
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          recallBotStatus: 'processing_failed',
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }

  private formatTranscript(transcript: RecallTranscript): string {
    if (!transcript || transcript.length === 0) return ''

    return transcript
      .map((segment: TranscriptSegment) => {
        const speaker = segment.speaker || 'Unknown'
        const text = segment.words?.map((w: TranscriptWord) => w.text).join(' ') || segment.text || ''
        const timestamp = segment.start_time ? 
          new Date(segment.start_time * 1000).toISOString().substr(11, 8) : ''
        
        return `[${timestamp}] ${speaker}: ${text}`
      })
      .filter(line => line.trim().length > 0)
      .join('\n')
  }

  // Get polling statistics
  private async getPollingStats() {
    try {
      const active = await prisma.meeting.count({
        where: {
          recallBotId: { not: null },
          recallBotStatus: {
            in: ['ready', 'joining_call', 'in_waiting_room', 'in_call_not_recording', 'in_call_recording']
          }
        }
      })

      const completed = await prisma.meeting.count({
        where: {
          recallBotId: { not: null },
          recallBotStatus: 'completed'
        }
      })

      const failed = await prisma.meeting.count({
        where: {
          recallBotId: { not: null },
          recallBotStatus: {
            in: ['processing_failed', 'no_transcript']
          }
        }
      })

      return { active, completed, failed }
    } catch (error) {
      console.error('Error getting polling stats:', error)
      return { active: 0, completed: 0, failed: 0 }
    }
  }
}

// Singleton instance
export const pollingService = new PollingService()