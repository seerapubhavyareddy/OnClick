// lib/google-calendar.ts
import { google } from 'googleapis'
import { prisma } from './prisma'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  hangoutLink?: string
  location?: string
  meetingUrl?: string
  platform?: string
}

export class GoogleCalendarClient {
  private oauth2Client: any

  constructor(accessToken: string, refreshToken?: string) {
    console.log(`🔧 GoogleCalendarClient constructor called:`, {
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length || 0
    })
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    
    console.log(`🔧 OAuth2Client credentials set:`, {
      hasAccessToken: !!this.oauth2Client.credentials.access_token,
      hasRefreshToken: !!this.oauth2Client.credentials.refresh_token
    })
  }

  // Get upcoming calendar events with automatic token refresh
  async getUpcomingEvents(maxResults = 20): Promise<CalendarEvent[]> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      })

      const events = response.data.items || []
      
      return events.map(event => {
        // Extract meeting URL and platform
        const meetingUrl = this.extractMeetingUrl(event)
        const platform = meetingUrl ? this.getMeetingPlatform(meetingUrl) : undefined

        return {
          id: event.id!,
          summary: event.summary || 'No Title',
          description: event.description ?? undefined,
          start: {
            dateTime: event.start?.dateTime || event.start?.date || '',
            timeZone: event.start?.timeZone || 'UTC',
          },
          end: {
            dateTime: event.end?.dateTime || event.end?.date || '',
            timeZone: event.end?.timeZone || 'UTC',
          },
          attendees: event.attendees?.map(attendee => ({
            email: attendee.email!,
            displayName: attendee.displayName ?? undefined,
            responseStatus: attendee.responseStatus ?? undefined,
          })),
          hangoutLink: event.hangoutLink ?? undefined,
          location: event.location ?? undefined,
          meetingUrl: meetingUrl ?? undefined,
          platform: platform ?? undefined,
        }
      })
    } catch (error: unknown) {
      console.error('Error fetching calendar events:', error)
      
      // Handle token refresh if needed
      if (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as any).code === 401) {
        try {
          console.log('🔄 Token expired, attempting refresh...')
          const { credentials } = await this.oauth2Client.refreshAccessToken()
          
          // Update credentials
          this.oauth2Client.setCredentials(credentials)
          
          console.log('✅ Token refreshed successfully')
          
          // Retry the request with new token
          return this.getUpcomingEvents(maxResults)
        } catch (refreshError) {
          console.error('❌ Error refreshing token:', refreshError)
          throw new Error('Failed to refresh Google Calendar access token. Please sign out and sign in again.')
        }
      }
      
      throw new Error('Failed to fetch calendar events')
    }
  }

  // Extract meeting URL from event
  private extractMeetingUrl(event: any): string | null {
    // Check hangoutLink first (Google Meet)
    if (event.hangoutLink) {
      return event.hangoutLink
    }

    // Check description and location for meeting links
    const textToSearch = [
      event.description || '',
      event.location || '',
    ].join(' ')

    // Zoom patterns
    const zoomPattern = /https:\/\/[a-zA-Z0-9.-]*\.?zoom\.us\/[a-zA-Z0-9\/?=&.-]+/gi
    const zoomMatch = textToSearch.match(zoomPattern)
    if (zoomMatch) return zoomMatch[0]

    // Teams patterns
    const teamsPattern = /https:\/\/teams\.microsoft\.com\/[a-zA-Z0-9\/?=&.-]+/gi
    const teamsMatch = textToSearch.match(teamsPattern)
    if (teamsMatch) return teamsMatch[0]

    // WebEx patterns
    const webexPattern = /https:\/\/[a-zA-Z0-9.-]*\.?webex\.com\/[a-zA-Z0-9\/?=&.-]+/gi
    const webexMatch = textToSearch.match(webexPattern)
    if (webexMatch) return webexMatch[0]

    // Generic meet patterns
    const meetPattern = /https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/gi
    const meetMatch = textToSearch.match(meetPattern)
    if (meetMatch) return meetMatch[0]

    return null
  }

  // Determine meeting platform from URL
  private getMeetingPlatform(url: string): string {
    const lowerUrl = url.toLowerCase()
    
    if (lowerUrl.includes('zoom.us')) return 'zoom'
    if (lowerUrl.includes('teams.microsoft.com')) return 'teams'
    if (lowerUrl.includes('meet.google.com')) return 'meet'
    if (lowerUrl.includes('webex.com')) return 'webex'
    if (lowerUrl.includes('gotomeeting.com')) return 'gotomeeting'
    
    return 'unknown'
  }
}

// Helper function to get calendar client for user with automatic token refresh
export async function getCalendarClientForUser(userId: string): Promise<GoogleCalendarClient | null> {
  try {
    console.log(`🔍 Getting calendar client for user: ${userId}`)
    
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    console.log(`📊 Account lookup result:`, {
      found: !!account,
      hasAccessToken: !!account?.access_token,
      hasRefreshToken: !!account?.refresh_token,
      accessTokenLength: account?.access_token?.length || 0,
      refreshTokenLength: account?.refresh_token?.length || 0,
      expiresAt: account?.expires_at,
      expiresAtDate: account?.expires_at ? new Date(account.expires_at * 1000).toISOString() : null
    })

    if (!account?.access_token) {
      console.log('❌ No Google account or access token found for user')
      return null
    }

    // Check if token is expired (expires_at is in seconds, Date.now() is in milliseconds)
    const now = Date.now()
    const expiryTime = account.expires_at ? account.expires_at * 1000 : 0
    const isTokenExpired = expiryTime < now
    const timeUntilExpiry = Math.max(0, expiryTime - now)
    
    console.log(`⏰ Token timing:`, {
      now: new Date(now).toISOString(),
      expiryTime: new Date(expiryTime).toISOString(),
      isTokenExpired,
      timeUntilExpiryMs: timeUntilExpiry,
      timeUntilExpiryMin: Math.floor(timeUntilExpiry / (1000 * 60))
    })
    
    if (isTokenExpired && account.refresh_token) {
      console.log('🔄 Token expired, refreshing before creating client...')
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.NEXTAUTH_URL + '/api/auth/callback/google'
      )

      oauth2Client.setCredentials({
        refresh_token: account.refresh_token,
      })

      try {
        const { credentials } = await oauth2Client.refreshAccessToken()

        // Update the stored tokens
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
          },
        })

        console.log('✅ Token refreshed and updated in database')

        // Return client with fresh token
        return new GoogleCalendarClient(
          credentials.access_token!, 
          account.refresh_token
        )
      } catch (refreshError) {
        console.error('❌ Failed to refresh token:', refreshError)
        return null
      }
    }

    // Token is still valid OR we don't have a refresh token, return client as normal
    console.log(`🔧 Creating GoogleCalendarClient with:`, {
      hasAccessToken: !!account.access_token,
      hasRefreshToken: !!account.refresh_token,
      refreshTokenLength: account.refresh_token?.length || 0
    })
    
    return new GoogleCalendarClient(
      account.access_token, 
      account.refresh_token || undefined
    )
  } catch (error) {
    console.error('Error getting calendar client:', error)
    return null
  }
}

// Helper function to refresh Google tokens if needed
export async function refreshGoogleTokens(userId: string): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    if (!account?.refresh_token) {
      return false
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()

    // Update the stored tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
      },
    })

    return true
  } catch (error) {
    console.error('Error refreshing Google tokens:', error)
    return false
  }
}