// lib/polling-service.ts - Optimized for Supabase
import { prisma } from './prisma'
import { recallClient } from './recall-client'
import type { RecallTranscript, TranscriptSegment, TranscriptWord } from './types/transcript'

export class PollingService {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 60000 // Increased to 60 seconds (was 30s)
  private readonly MAX_RETRIES = 60 // Reduced retries (was 120)
  private isPolling = false // Prevent concurrent polling

  async startPolling() {
    if (this.isRunning) {
      console.log('🔄 Polling service already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting optimized Recall.ai polling service')

    this.intervalId = setInterval(async () => {
      // Prevent concurrent polling operations
      if (!this.isPolling) {
        await this.pollActiveBots()
      }
    }, this.POLL_INTERVAL)

    // Also run immediately
    await this.pollActiveBots()
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

  private async pollActiveBots() {
    if (this.isPolling) {
      console.log('⏸️ Polling already in progress, skipping...')
      return
    }

    this.isPolling = true
    
    try {
      // Get only a limited number of active meetings to reduce DB load
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
        take: 5, // Limit to 5 meetings at a time
        orderBy: {
          lastPolledAt: 'asc' // Poll oldest first
        }
      })

      console.log(`🔍 Polling ${activeMeetings.length} active bots (limited batch)`)

      // Process meetings sequentially to avoid connection spikes
      for (const meeting of activeMeetings) {
        try {
          await this.pollSingleBot(meeting)
          // Small delay between each bot check
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`❌ Error polling bot ${meeting.recallBotId}:`, error)
          continue // Continue with next bot
        }
      }

      // Log completed meetings count (but don't fetch them to save connections)
      const completedCount = await prisma.meeting.count({
        where: {
          recallBotId: { not: null },
          recallBotStatus: {
            in: ['done', 'call_ended', 'completed']
          }
        }
      })
      
      console.log(`✅ Found ${completedCount} completed meetings`)

    } catch (error) {
      console.error('❌ Error in polling service:', error)
    } finally {
      this.isPolling = false
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

      // Update meeting with latest bot status in a single operation
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
        console.log(`✅ Bot ${meeting.recallBotId} completed`)
        await this.processCompletedBot(meeting, bot)
      }

    } catch (error) {
      console.error(`❌ Error processing bot ${meeting.recallBotId}:`, error)
      
      // Update error status in single operation
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
        
        // Single database update for completed meeting
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

        console.log(`✅ Transcript saved for: ${meeting.title}`)
      } else {
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
}

// Singleton instance
export const pollingService = new PollingService()