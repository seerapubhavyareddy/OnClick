// src/app/page.tsx - Updated with Past Meetings and Polling Status
'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { CalendarIcon, SettingsIcon, CheckCircleIcon, ClockIcon, UsersIcon, LinkIcon, RefreshCwIcon, AlertCircleIcon, X } from 'lucide-react'

interface CalendarEvent {
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
  }>
  meetingUrl?: string
  platform?: string
  noteTakerEnabled: boolean
  hasValidMeetingUrl: boolean
}

interface PastMeeting {
  id: string
  title: string
  description?: string
  startTime: string
  endTime?: string
  attendees: any[]
  platform?: string
  recallBotId?: string
  recallBotStatus?: string
  transcriptText?: string
  transcript?: any
  videoUrl?: string
  completedAt?: string
  noteTakerEnabled: boolean
  hasTranscript: boolean
  hasVideo: boolean
  attendeeCount: number
  duration?: number
}

export default function Home() {
  const { data: session, status } = useSession()
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [pastMeetings, setPastMeetings] = useState<PastMeeting[]>([])
  const [pollingStats, setPollingStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)

  useEffect(() => {
    if (session) {
      fetchCalendarEvents()
      fetchPastMeetings()
      fetchPollingStats()
      startPollingService()
      
      // Check token status and refresh if needed
      checkAndRefreshTokens()
      
      // Set up token refresh interval (every 30 minutes)
      const tokenRefreshInterval = setInterval(checkAndRefreshTokens, 30 * 60 * 1000)
      
      return () => clearInterval(tokenRefreshInterval)
    }
  }, [session])

  const fetchCalendarEvents = async () => {
    try {
      setError(null)
      const response = await fetch('/api/calendar/events')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch calendar events')
      }
      
      const events = await response.json()
      setCalendarEvents(events)
    } catch (error: any) {
      console.error('Error fetching calendar events:', error)
      setError(error.message)
      
      // If it's an auth error, show helpful message
      if (error.message?.includes('Calendar not connected') || error.message?.includes('expired')) {
        setError('Calendar access expired. Please sign out and sign in again to refresh permissions.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchPastMeetings = async () => {
    try {
      const response = await fetch('/api/meetings/past')
      if (response.ok) {
        const meetings = await response.json()
        setPastMeetings(meetings)
      }
    } catch (error) {
      console.error('Error fetching past meetings:', error)
    }
  }

  const fetchPollingStats = async () => {
    try {
      const response = await fetch('/api/polling')
      if (response.ok) {
        const stats = await response.json()
        setPollingStats(stats)
      }
    } catch (error) {
      console.error('Error fetching polling stats:', error)
    }
  }

  const startPollingService = async () => {
    try {
      await fetch('/api/polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })
    } catch (error) {
      console.error('Error starting polling service:', error)
    }
  }

  const checkAndRefreshTokens = async () => {
    try {
      const response = await fetch('/api/auth/refresh-tokens')
      const tokenStatus = await response.json()
      
      if (tokenStatus.isExpired || tokenStatus.expiresInMinutes < 10) {
        console.log('🔄 Token expiring soon, refreshing...')
        
        const refreshResponse = await fetch('/api/auth/refresh-tokens', {
          method: 'POST'
        })
        
        if (refreshResponse.ok) {
          console.log('✅ Token refreshed successfully')
        } else {
          console.error('❌ Failed to refresh token')
          setError('Calendar access expired. Please sign out and sign in again.')
        }
      }
    } catch (error) {
      console.error('Error checking token status:', error)
    }
  }

  const viewMeetingTranscript = async (meetingId: string) => {
    try {
      const response = await fetch('/api/meetings/past', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId })
      })
      
      if (response.ok) {
        const meeting = await response.json()
        setSelectedMeeting(meeting)
      }
    } catch (error) {
      console.error('Error fetching meeting transcript:', error)
    }
  }

  const refreshCalendarEvents = async () => {
    setRefreshing(true)
    try {
      // First refresh the calendar data
      const refreshResponse = await fetch('/api/calendar/events', {
        method: 'POST'
      })
      
      if (refreshResponse.ok) {
        // Then fetch updated events
        await fetchCalendarEvents()
        await fetchPastMeetings()
        await fetchPollingStats()
      }
    } catch (error) {
      console.error('Error refreshing calendar:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const toggleNoteTaker = async (eventId: string) => {
    try {
      const event = calendarEvents.find(e => e.id === eventId)
      if (!event) return

      // Optimistically update UI
      setCalendarEvents(events => 
        events.map(e => 
          e.id === eventId 
            ? { ...e, noteTakerEnabled: !e.noteTakerEnabled }
            : e
        )
      )

      const response = await fetch('/api/meetings/toggle-notetaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          eventId, 
          enabled: !event.noteTakerEnabled 
        }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setCalendarEvents(events => 
          events.map(e => 
            e.id === eventId 
              ? { ...e, noteTakerEnabled: !e.noteTakerEnabled }
              : e
          )
        )
        const errorData = await response.json()
        alert(errorData.error || 'Failed to toggle note taker')
      }
    } catch (error) {
      console.error('Error toggling note taker:', error)
      // Revert optimistic update on error
      setCalendarEvents(events => 
        events.map(e => 
          e.id === eventId 
            ? { ...e, noteTakerEnabled: !e.noteTakerEnabled }
            : e
        )
      )
    }
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getPlatformColor = (platform?: string) => {
    switch (platform) {
      case 'zoom': return 'bg-blue-100 text-blue-800'
      case 'teams': return 'bg-purple-100 text-purple-800'
      case 'meet': return 'bg-green-100 text-green-800'
      case 'webex': return 'bg-orange-100 text-orange-800'
      case 'gotomeeting': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <CalendarIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Meeting Social Generator
            </h1>
            <p className="text-gray-600 mb-8">
              Transform your meeting insights into engaging social media content
            </p>
            <button
              onClick={() => signIn('google')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <CalendarIcon className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Meeting Social Generator
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshCalendarEvents}
                disabled={refreshing}
                className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCwIcon className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <img
                src={session.user?.image || ''}
                alt="Profile"
                className="h-8 w-8 rounded-full"
              />
              <span className="text-gray-700">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Phase Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Phase 2: Google Calendar Integration ✅
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Authentication</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Calendar API</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">{loading ? 'Loading...' : `${calendarEvents.length} Events`}</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Polling Active</span>
            </div>
          </div>
          
          {/* Polling Stats */}
          {pollingStats && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Bot Status:</p>
              <div className="flex space-x-4 text-sm">
                <span className="text-blue-600">Active: {pollingStats.activeBots}</span>
                <span className="text-green-600">Completed: {pollingStats.completedBots}</span>
                <span className="text-red-600">Failed: {pollingStats.failedBots}</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircleIcon className="h-5 w-5 text-red-600 mr-3" />
              <div>
                <p className="text-red-800 font-medium">Calendar Error</p>
                <p className="text-red-600 text-sm">{error}</p>
                {error.includes('expired') && (
                  <button
                    onClick={() => signOut()}
                    className="mt-2 text-sm text-red-700 underline hover:text-red-900"
                  >
                    Sign out and sign in again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Meetings */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Your Upcoming Meetings
            </h2>
            <p className="text-sm text-gray-500">
              From your Google Calendar
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading your calendar events...</p>
            </div>
          ) : calendarEvents.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {calendarEvents.map(event => (
                <div key={event.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
                      {event.summary}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={event.noteTakerEnabled}
                          onChange={() => toggleNoteTaker(event.id)}
                          disabled={!event.hasValidMeetingUrl}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-600">Bot</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      {formatDateTime(event.start.dateTime)}
                    </div>
                    
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 mr-2" />
                        {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                      </div>
                    )}

                    <div className="flex items-center">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      {event.platform ? (
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${getPlatformColor(event.platform)}`}>
                          {event.platform}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No meeting link</span>
                      )}
                    </div>
                  </div>

                  {!event.hasValidMeetingUrl && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ No meeting link detected. Add Zoom/Teams/Meet link to enable bot.
                      </p>
                    </div>
                  )}

                  {event.noteTakerEnabled && event.hasValidMeetingUrl && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-green-800 text-sm font-medium">
                        ✓ Note-taking bot will join this meeting
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No upcoming meetings found</p>
              <p className="text-sm text-gray-400">
                Meetings from your Google Calendar will appear here
              </p>
              <button
                onClick={refreshCalendarEvents}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Refresh Calendar
              </button>
            </div>
          )}
        </div>

        {/* Past Meetings */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Past Meetings
            </h2>
            <p className="text-sm text-gray-500">
              Meetings with transcripts
            </p>
          </div>

          {pastMeetings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastMeetings.map(meeting => (
                <div key={meeting.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
                      {meeting.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {meeting.platform && (
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${getPlatformColor(meeting.platform)}`}>
                          {meeting.platform}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      {formatDateTime(meeting.startTime)}
                    </div>
                    
                    {meeting.attendeeCount > 0 && (
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 mr-2" />
                        {meeting.attendeeCount} attendee{meeting.attendeeCount !== 1 ? 's' : ''}
                      </div>
                    )}

                    {meeting.duration && (
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        {meeting.duration} minutes
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {meeting.hasTranscript ? (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="text-green-800 text-sm font-medium mb-2">
                          ✓ Transcript Available
                        </p>
                        <button
                          onClick={() => viewMeetingTranscript(meeting.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          View Transcript
                        </button>
                      </div>
                    ) : meeting.noteTakerEnabled ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-yellow-800 text-sm">
                          ⏳ Processing transcript... Status: {meeting.recallBotStatus}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded p-3">
                        <p className="text-gray-600 text-sm">
                          📋 No bot was enabled for this meeting
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No past meetings found</p>
              <p className="text-sm text-gray-400">
                Past meetings with transcripts will appear here
              </p>
            </div>
          )}
        </div>

        {/* Transcript Modal */}
        {selectedMeeting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedMeeting.title}
                  </h3>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {formatDateTime(selectedMeeting.startTime)}
                </p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {selectedMeeting.transcriptText ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Meeting Transcript:</h4>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">
                      {selectedMeeting.transcriptText}
                    </div>
                    
                    {selectedMeeting.videoUrl && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Video Recording:</h4>
                        <a
                          href={selectedMeeting.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View Recording
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No transcript available for this meeting</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Status: {selectedMeeting.recallBotStatus || 'No bot enabled'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Integration Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Calendar Integration Status
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {session.user?.name}</p>
              <p><span className="font-medium">Email:</span> {session.user?.email}</p>
              <p><span className="font-medium">Authentication:</span> ✅ Active</p>
              <p><span className="font-medium">Calendar Access:</span> {error ? '❌ Error' : '✅ Connected'}</p>
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Upcoming Events:</span> {calendarEvents.length}</p>
              <p><span className="font-medium">Past Meetings:</span> {pastMeetings.length}</p>
              <p><span className="font-medium">With Meeting URLs:</span> {calendarEvents.filter(e => e.hasValidMeetingUrl).length}</p>
              <p><span className="font-medium">Bots Enabled:</span> {calendarEvents.filter(e => e.noteTakerEnabled).length}</p>
              <p><span className="font-medium">Phase 2:</span> ✅ Complete</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}