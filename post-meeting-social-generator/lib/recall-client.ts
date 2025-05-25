// lib/recall-client.ts
import axios from 'axios'

const recallApi = axios.create({
  baseURL: process.env.RECALL_API_URL || 'https://us-east-1.recall.ai/api/v1',
  headers: {
    'Authorization': `Token ${process.env.RECALL_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000', // Add Referer header
    'Origin': process.env.NEXTAUTH_URL || 'http://localhost:3000',   // Add Origin header
    'User-Agent': 'Meeting-Social-Generator/1.0',                   // Add User-Agent
  },
})

// Add request interceptor to ensure headers are always present
recallApi.interceptors.request.use(request => {
  // Make sure these headers are always included
  request.headers['Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  request.headers['Origin'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  request.headers['X-Requested-With'] = 'XMLHttpRequest'
  
  console.log('🚀 Recall API Request:')
  console.log('- URL:', `${request.baseURL ?? ''}${request.url ?? ''}`)
  console.log('- Method:', request.method?.toUpperCase())
  console.log('- Headers:', request.headers)
  return request
})

// Keep the existing response interceptor
recallApi.interceptors.response.use(
  response => {
    console.log('✅ Recall API Success:', response.status, response.data?.id || 'No ID')
    return response
  },
  error => {
    console.log('❌ Recall API Error Details:')
    console.log('- Status:', error.response?.status)
    console.log('- URL:', error.config?.url)
    console.log('- Response:', error.response?.data)
    return Promise.reject(error)
  }
)

export interface RecallBot {
  id: string
  meeting_url: string
  status_changes?: Array<{
    code: string
    message?: string
    created_at: string
    sub_code?: string
    recording_id?: string
  }>
  join_at?: string
  bot_name?: string
  recording_mode?: 'speaker_view' | 'gallery_view' | 'audio_only'
  transcription_options?: {
    provider: string
  }
  video_url?: string
  transcript?: any[]
  meeting_metadata?: any
  meeting_participants?: any[]
  speaker_timeline?: any
  calendar_meeting_id?: string
  calendar_user_id?: string
  calendar_meetings?: any[]
}

export interface CreateBotRequest {
  meeting_url: string
  join_at?: string // ISO timestamp for scheduled bots
  bot_name?: string
  recording_mode?: 'speaker_view' | 'gallery_view' | 'audio_only'
  transcription_options?: {
    provider: 'meeting_captions' | 'deepgram' | 'assembly_ai'
  }
}

export class RecallApiClient {
  // Create a new bot
  async createBot(data: CreateBotRequest): Promise<RecallBot> {
    console.log('🤖 Creating Recall bot:', data)
    try {
      const response = await recallApi.post('/bot', data)
      console.log('✅ Bot created successfully:', response.data.id)
      return response.data
    } catch (error: any) {
      console.error('❌ Bot creation failed:', error.response?.data || error.message)
      throw new Error(`Failed to create Recall bot: ${error.response?.data?.detail || error.message}`)
    }
  }

  // Get bot by ID
  async getBot(botId: string): Promise<RecallBot> {
    try {
      const response = await recallApi.get(`/bot/${botId}`)
      return response.data
    } catch (error: any) {
      console.error('❌ Get bot failed:', error.response?.data || error.message)
      throw new Error(`Failed to get bot: ${error.response?.data?.detail || error.message}`)
    }
  }

  // List all bots (with pagination)
  async listBots(limit = 100, offset = 0): Promise<{ results: RecallBot[] }> {
    try {
      const response = await recallApi.get('/bot', {
        params: { limit, offset }
      })
      return response.data
    } catch (error: any) {
      console.error('❌ List bots failed:', error.response?.data || error.message)
      throw new Error(`Failed to list bots: ${error.response?.data?.detail || error.message}`)
    }
  }

  // Delete a bot
  async deleteBot(botId: string): Promise<void> {
    try {
      await recallApi.delete(`/bot/${botId}`)
      console.log('🗑️ Bot deleted:', botId)
    } catch (error: any) {
      console.error('❌ Delete bot failed:', error.response?.data || error.message)
      throw new Error(`Failed to delete bot: ${error.response?.data?.detail || error.message}`)
    }
  }

  // Get bot transcript
  async getBotTranscript(botId: string): Promise<any[]> {
    try {
      const response = await recallApi.get(`/bot/${botId}/transcript`)
      return response.data
    } catch (error: any) {
      console.error('❌ Get transcript failed:', error.response?.data || error.message)
      return []
    }
  }

  // Poll for bot status until completed
  // Poll for bot status until completed
async pollBotUntilDone(botId: string, maxRetries = 60, intervalMs = 10000): Promise<RecallBot> {
  let retries = 0
  
  console.log(`🔄 Starting to poll bot ${botId}...`)
  
  while (retries < maxRetries) {
    try {
      const bot = await this.getBot(botId)
      
      // Get the latest status from status_changes array
      const latestStatus = bot.status_changes && bot.status_changes.length > 0 
        ? bot.status_changes[bot.status_changes.length - 1]?.code
        : 'unknown'
      
      console.log(`📊 Bot ${botId} status: ${latestStatus} (attempt ${retries + 1})`)
      
      if (latestStatus === 'done' || latestStatus === 'call_ended') {
        console.log(`✅ Bot ${botId} completed with status: ${latestStatus}`)
        return bot
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      retries++
    } catch (error) {
      console.error(`❌ Error polling bot ${botId}:`, error)
      retries++
    }
  }
  
  throw new Error(`Bot ${botId} did not complete within expected time`)
}
}

export const recallClient = new RecallApiClient()