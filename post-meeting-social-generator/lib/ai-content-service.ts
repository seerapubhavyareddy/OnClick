// lib/ai-content-service.ts - Updated with better prompts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface GeneratePostRequest {
  transcript: string
  meetingTitle: string
  attendees?: string[]
  platform: 'linkedin' | 'facebook'
  customPrompt?: string
}

export interface GenerateEmailRequest {
  transcript: string
  meetingTitle: string
  attendees?: string[]
}

export class AIContentService {
  
  async generateSocialPost(request: GeneratePostRequest): Promise<string> {
    try {
      const { transcript, meetingTitle, attendees, platform, customPrompt } = request
      
      const prompt = customPrompt || this.getDefaultPrompt(platform, transcript, meetingTitle, attendees)

      console.log(`🤖 Generating ${platform} post for meeting: ${meetingTitle}`)

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        return content.text.trim()
      }
      
      throw new Error('Unexpected response format from Claude')

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error generating social post:', error)
      throw new Error(`Failed to generate social post: ${message}`)
    }
  }

  private getDefaultPrompt(platform: 'linkedin' | 'facebook', transcript: string, meetingTitle: string, attendees?: string[]): string {
    const baseContext = `Meeting Title: ${meetingTitle}
Meeting Transcript: ${transcript}
${attendees && attendees.length > 0 ? `Attendees: ${attendees.join(', ')}` : ''}`

    const platformPrompts: Record<'linkedin' | 'facebook', string> = {
      linkedin: `Based on this meeting transcript, create a professional LinkedIn post that shares what was learned or discussed in the meeting. 

${baseContext}

Requirements:
- Write in first person as someone who attended this meeting
- Share 1-2 key insights, lessons learned, or interesting points from the actual meeting discussion
- Keep it professional but engaging
- 100-150 words maximum
- End with exactly 2 relevant hashtags
- Don't assume any specific industry unless clearly mentioned in the transcript
- Focus on what was actually discussed, not generic advice
- Show excitement about what was learned/discussed

Return only the post text with hashtags at the end.`,

      facebook: `Based on this meeting transcript, create an engaging Facebook post that shares what was learned or discussed in the meeting.

${baseContext}

Requirements:
- Write in first person as someone who attended this meeting  
- Share 1-2 key insights or interesting points from the actual meeting discussion
- Keep it friendly and slightly more casual than LinkedIn
- 80-120 words maximum
- End with exactly 2 relevant hashtags
- Don't assume any specific industry unless clearly mentioned in the transcript
- Focus on what was actually discussed in the meeting
- Show enthusiasm about what was shared/learned
- Can include a question to engage readers

Return only the post text with hashtags at the end.`
    }

    return platformPrompts[platform]
  }

  async summarizeTranscript(transcript: string, meetingTitle: string): Promise<string> {
    try {
      const prompt = `Please create a concise summary of this meeting transcript:

Meeting Title: ${meetingTitle}
Transcript: ${transcript}

Provide a summary that includes:
1. Main topics discussed (3-5 bullet points)
2. Key decisions made (if any)
3. Action items and next steps (if any)
4. Important insights or recommendations (if any)

Keep it professional and concise. If the meeting was informal or didn't have clear structure, mention that but still extract the main points discussed.`

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Use Haiku for summaries (faster/cheaper)
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const content = response.content[0]
      if (content.type === 'text') {
        return content.text.trim()
      }
      
      throw new Error('Unexpected response format from Claude')

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error summarizing transcript:', error)
      throw new Error(`Failed to summarize transcript: ${message}`)
    }
  }
}

export const aiContentService = new AIContentService()