// lib/polling-service.ts
import { prisma } from './prisma'
import { recallClient } from './recall-client'
import type { RecallTranscript, TranscriptSegment, TranscriptWord } from './types/transcript'

export class PollingService {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 30000 // 30 seconds
  private readonly MAX_RETRIES = 120 // 1 hour of polling (120 * 30s = 1 hour)

  async startPolling() {
    if (this.isRunning) {
      console.log('🔄 Polling service already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting Recall.ai polling service')

    this.intervalId = setInterval(async () => {
      await this.pollActiveBots()
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
    console.log('⏹️ Polling service stopped')
  }

  private async pollActiveBots() {
    try {
      // Get all meetings with active bots that need polling
      // Based on Recall.ai docs, valid statuses are: ready, joining_call, in_waiting_room, 
      // in_call_not_recording, in_call_recording, call_ended, done, fatal
      const activeMeetings = await prisma.meeting.findMany({
        where: {
          recallBotId: { not: null },
          OR: [
            // Active statuses that need polling
            {
              recallBotStatus: {
                in: ['ready', 'joining_call', 'in_waiting_room', 'in_call_not_recording', 'in_call_recording']
              }
            },
            // Include null status (newly created bots)
            {
              recallBotStatus: null
            },
            // Include unknown status
            {
              recallBotStatus: 'unknown'
            }
          ],
          pollRetries: { lt: this.MAX_RETRIES }
        }
      })

      console.log(`🔍 Polling ${activeMeetings.length} active bots`)
      
      // Also log meetings that might be completed
      const completedMeetings = await prisma.meeting.findMany({
        where: {
          recallBotId: { not: null },
          recallBotStatus: {
            in: ['done', 'call_ended', 'fatal']
          }
        }
      })
      
      console.log(`✅ Found ${completedMeetings.length} completed meetings`)

      for (const meeting of activeMeetings) {
        await this.pollSingleBot(meeting)
      }
    } catch (error) {
      console.error('❌ Error in polling service:', error)
    }
  }

  private async pollSingleBot(meeting: any) {
    try {
      if (!meeting.recallBotId) return

      console.log(`🤖 Polling bot ${meeting.recallBotId} for meeting: ${meeting.title} (current status: ${meeting.recallBotStatus})`)

      // Get bot status from Recall.ai
      const bot = await recallClient.getBot(meeting.recallBotId)
      
      // Get the latest status from status_changes array
      const latestStatus = bot.status_changes && bot.status_changes.length > 0 
        ? bot.status_changes[bot.status_changes.length - 1]?.code
        : 'unknown'
      
      console.log(`📡 Recall.ai bot response:`)
      console.log(`   - Latest status: ${latestStatus}`)
      console.log(`   - Status changes count: ${bot.status_changes?.length || 0}`)
      console.log(`   - Video URL: ${bot.video_url ? 'Available' : 'Not available'}`)
      
      // Update meeting with latest bot status
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          recallBotStatus: latestStatus,
          pollRetries: { increment: 1 },
          lastPolledAt: new Date()
        }
      })

      // Check if bot is done and transcript is available
      if (latestStatus === 'done' || latestStatus === 'call_ended') {
        console.log(`✅ Bot ${meeting.recallBotId} completed with status: ${latestStatus}`)
        await this.processCompletedBot(meeting, bot)
      } else {
        console.log(`📊 Bot ${meeting.recallBotId} status: ${latestStatus}`)
      }

    } catch (error: unknown) {
  console.error(`❌ Error processing completed bot:`, error)

  const message = error instanceof Error ? error.message : 'Unknown error'
      
      // Increment retry count
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          pollRetries: { increment: 1 },
          lastPolledAt: new Date(),
          lastError: message
        }
      })
    }
  }

  private async processCompletedBot(meeting: any, bot: any) {
    try {
      console.log(`🎯 Processing completed bot for meeting: ${meeting.title}`)

      // Get transcript from Recall.ai
      const transcript = await recallClient.getBotTranscript(meeting.recallBotId)
      
      if (transcript && transcript.length > 0) {
        console.log(`📝 Retrieved transcript with ${transcript.length} segments`)
        
        // Convert transcript to readable format
        const transcriptText = this.formatTranscript(transcript)
        
        // Update meeting with transcript
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotStatus: 'completed',
            transcript: transcript, // Store raw transcript
            transcriptText: transcriptText, // Store formatted text
            videoUrl: bot.video_url,
            completedAt: new Date()
          }
        })

        console.log(`✅ Transcript saved for meeting: ${meeting.title}`)
        
      } else {
        console.log(`⚠️ No transcript available for bot ${meeting.recallBotId}`)
        
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recallBotStatus: 'no_transcript',
            completedAt: new Date()
          }
        })
      }

    } catch (error: unknown) {
  console.error(`❌ Error processing completed bot:`, error)

  const message = error instanceof Error ? error.message : 'Unknown error'
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          recallBotStatus: 'processing_failed',
          lastError: message
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