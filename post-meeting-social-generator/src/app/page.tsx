// src/app/page.tsx - FIXED VERSION with proper user session isolation
'use client'

import '../../lib/app-initializer' // This will auto-start polling
import { useState, useEffect, useCallback } from 'react'
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
  accountInfo?: {
    email: string
    name?: string
  }
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
  const [generatedContent, setGeneratedContent] = useState<any>(null)
  const [generatingContent, setGeneratingContent] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  const ensurePollingIsRunning = async () => {
    try {
      const response = await fetch('/api/polling')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Polling status:', data)
      } else {
        // Start polling if not running
        console.log('🚀 Starting polling service...')
        await fetch('/api/polling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' })
        })
      }
    } catch (error) {
      console.error('Error checking polling status:', error)
    }
  }

  // Clear data when session changes to prevent cross-contamination
  const clearUserData = useCallback(() => {
    setCalendarEvents([])
    setPastMeetings([])
    setPollingStats(null)
    setSelectedMeeting(null)
    setGeneratedContent(null)
    setError(null)
    setCurrentUserEmail(null)
  }, [])

  // Monitor session changes and clear data if user changes
  useEffect(() => {
    if (session?.user?.email) {
      if (currentUserEmail && currentUserEmail !== session.user.email) {
        console.log('🔄 User changed, clearing data...')
        clearUserData()
      }
      setCurrentUserEmail(session.user.email)
    } else if (!session && currentUserEmail) {
      console.log('🔄 User signed out, clearing data...')
      clearUserData()
    }
  }, [session?.user?.email, currentUserEmail, clearUserData])

  useEffect(() => {
    if (session?.user?.email) {
      console.log('📊 Loading data for user:', session.user.email)
      fetchCalendarEvents()
      fetchPastMeetings()
      checkAndRefreshTokens()

      // Ensure polling service is running
      ensurePollingIsRunning()
    

      // Set up token refresh interval (every 30 minutes)
      const tokenRefreshInterval = setInterval(checkAndRefreshTokens, 30 * 60 * 1000)
      
      return () => clearInterval(tokenRefreshInterval)
    }
  }, [session?.user?.email])

  const fetchCalendarEvents = async () => {
    if (!session?.user?.email) return
    
    try {
      setError(null)
      console.log('📅 Fetching calendar events for:', session.user.email)
      
      const response = await fetch('/api/calendar/events', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch calendar events')
      }
      
      const events = await response.json()
      console.log('✅ Calendar events loaded:', events.length)
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

      // Add this to your main page (src/app/page.tsx) after the existing useEffect hooks

    const [showLinkedInInfo, setShowLinkedInInfo] = useState(false)

    useEffect(() => {
      // Check for LinkedIn info parameter
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('linkedin_info') === 'true') {
        setShowLinkedInInfo(true)
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }, [])

  const fetchPastMeetings = async () => {
    if (!session?.user?.email) return
    
    try {
      console.log('📋 Fetching past meetings for:', session.user.email)
      
      const response = await fetch('/api/meetings/past', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const meetings = await response.json()
        console.log('✅ Past meetings loaded:', meetings.length)
        setPastMeetings(meetings)
      } else {
        console.error('Failed to fetch past meetings')
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

  const checkAndRefreshTokens = async () => {
    if (!session?.user?.email) return
    
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

  const generateContent = async (meetingId: string, type: string, platform?: string) => {
    setGeneratingContent(true)
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, type, platform })
      })
      
      if (response.ok) {
        const result = await response.json()
        setGeneratedContent({
          ...result,
          meetingId
        })
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate content')
      }
    } catch (error) {
      console.error('Error generating content:', error)
      alert('Failed to generate content')
    } finally {
      setGeneratingContent(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Content copied to clipboard!')
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

  const handleSignOut = async () => {
    console.log('🔓 Signing out and clearing data...')
    clearUserData()
    await signOut()
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
              
              <a 
                href="/settings"
                className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <SettingsIcon className="h-4 w-4 mr-1" />
                Settings
              </a>
              
              <img
                src={session.user?.image || ''}
                alt="Profile"
                className="h-8 w-8 rounded-full"
                key={session.user?.email} // Force re-render when user changes
              />
              <span className="text-gray-700">{session.user?.name}</span>
              <span className="text-xs text-gray-500">({session.user?.email})</span>
              <button
                onClick={handleSignOut}
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
            Multiple Google Calendar Integration ✅
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
              <span className="text-gray-700">User: {currentUserEmail}</span>
            </div>
          </div>
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
                    onClick={handleSignOut}
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
              From your Google Calendar accounts
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

                    {event.accountInfo && (
                      <div className="flex items-center">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          📧 {event.accountInfo.email}
                        </span>
                      </div>
                    )}
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
                Meetings from your Google Calendar accounts will appear here
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
              Your completed meetings with transcripts
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

                  <div className="space-y-3">
                    {meeting.hasTranscript ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-green-800 text-sm font-medium mb-4">
                          ✓ Transcript Available
                        </p>
                        
                        {/* Clean Action Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <button
                            onClick={() => viewMeetingTranscript(meeting.id)}
                            className="flex items-center justify-center px-3 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-md hover:bg-green-50 transition-colors"
                          >
                            📄 View Transcript
                          </button>
                          
                          <button
                            onClick={() => generateContent(meeting.id, 'summary')}
                            disabled={generatingContent}
                            className="flex items-center justify-center px-3 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            📝 Summary
                          </button>
                        </div>

                        {/* Social Media Posts - Full Width Buttons */}
                        <div className="space-y-2">
                          <button
                            onClick={() => generateContent(meeting.id, 'social_post', 'linkedin')}
                            disabled={generatingContent}
                            className="w-full flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            💼 Generate LinkedIn Post
                          </button>
                          
                          <button
                            onClick={() => generateContent(meeting.id, 'social_post', 'facebook')}
                            disabled={generatingContent}
                            className="w-full flex items-center justify-center px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
                          >
                            📘 Generate Facebook Post
                          </button>
                        </div>

                        {generatingContent && (
                          <div className="mt-3 flex items-center justify-center text-sm text-blue-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Generating content...
                          </div>
                        )}
                      </div>
                    ) : meeting.noteTakerEnabled ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 text-sm">
                          ⏳ Processing transcript...
                        </p>
                        <p className="text-yellow-600 text-xs mt-1">
                          Status: {meeting.recallBotStatus}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
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

        {/* Content Generation Modal */}
        {generatedContent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {generatedContent.type === 'social_post' ? 'Draft Post' :
                      generatedContent.type === 'summary' ? 'Meeting Summary' : 'Generated Content'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {generatedContent.type === 'social_post' && 
                        `Generate a post based on insights from this meeting.`
                      }
                      {generatedContent.type === 'summary' && 
                        `Summary of: ${generatedContent.meetingTitle}`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setGeneratedContent(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {generatedContent.content}
                    </div>
                  </div>
                  
                  {/* Show disclaimer only for social posts */}
                  {generatedContent.type === 'social_post' && (
                    <p className="text-xs text-gray-500 italic">
                      The views expressed are for informational purposes only and do not constitute financial advice. 
                      Past performance is no guarantee of future results.
                    </p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {generatedContent.type === 'social_post' && (
                        <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {generatedContent.platform?.charAt(0).toUpperCase() + generatedContent.platform?.slice(1)} Post
                        </span>
                      )}
                      {generatedContent.type === 'summary' && (
                        <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                          Meeting Summary
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => copyToClipboard(generatedContent.content)}
                        className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        📋 Copy
                      </button>
                      
                      {generatedContent.type === 'social_post' && (
                        <button
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          onClick={async () => {
                            // Check if user has the platform connected
                            const isConnected = session?.user?.socialAccounts?.some(
                              account => account.platform === generatedContent.platform
                            );
                            
                            if (!isConnected) {
                              alert(`Please connect your ${generatedContent.platform?.charAt(0).toUpperCase() + generatedContent.platform?.slice(1)} account in Settings first!`);
                              return;
                            }
                            
                            // Try to post
                            try {
                              const response = await fetch('/api/social/post', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  platform: generatedContent.platform,
                                  content: generatedContent.content,
                                  meetingId: generatedContent.meetingId || null
                                })
                              });
                              
                              if (response.ok) {
                                const result = await response.json();
                                if (result.demo) {
                                  alert(`🎯 Demo Post Created!\n\n✅ Content would be posted to ${generatedContent.platform}\n✅ Mock URL: ${result.postUrl}\n\nNote: This is a demonstration. Real posting requires LinkedIn business API approval.`);
                                } else {
                                  alert(`✅ Successfully posted to ${generatedContent.platform}!\n\nPost URL: ${result.postUrl}`);
                                }
                                setGeneratedContent(null);
                              } else {
                                const error = await response.json();
                                alert(`❌ Failed to post: ${error.error}`);
                              }
                            } catch (error) {
                              console.error('Post error:', error);
                              alert('❌ Failed to post to social media');
                            }
                          }}
                        >
                          📤 Post to {generatedContent.platform?.charAt(0).toUpperCase() + generatedContent.platform?.slice(1)}
                        </button>
                      )}
                      
                      <button
                        onClick={() => setGeneratedContent(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
              <p><span className="font-medium">Current User:</span> {session.user?.name}</p>
              <p><span className="font-medium">Email:</span> {session.user?.email}</p>
              <p><span className="font-medium">Authentication:</span> ✅ Active</p>
              <p><span className="font-medium">Calendar Access:</span> {error ? '❌ Error' : '✅ Connected'}</p>
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Upcoming Events:</span> {calendarEvents.length}</p>
              <p><span className="font-medium">Past Meetings:</span> {pastMeetings.length}</p>
              <p><span className="font-medium">With Meeting URLs:</span> {calendarEvents.filter(e => e.hasValidMeetingUrl).length}</p>
              <p><span className="font-medium">Bots Enabled:</span> {calendarEvents.filter(e => e.noteTakerEnabled).length}</p>
              <p><span className="font-medium">Google Accounts:</span> {session.user?.googleAccounts?.length || 0}</p>
            </div>
          </div>
        </div>

            {/* // Add this modal at the end of your JSX, before the closing main tag */}
        {showLinkedInInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  LinkedIn Connection
                </h3>
                
                <div className="text-sm text-gray-600 mb-6 text-left">
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                    <p className="text-blue-800 font-medium mb-2">LinkedIn is for posting content, not signing in!</p>
                    <p className="text-blue-700 text-sm">
                      Connect your LinkedIn account after signing in with Google to post meeting insights to LinkedIn.
                    </p>
                  </div>
                  
                  <p className="mb-3"><strong>To connect LinkedIn:</strong></p>
                  <ol className="list-decimal list-inside space-y-2 mb-4">
                    <li>Sign in with your <strong>Google account</strong> first</li>
                    <li>Go to <strong>Settings</strong> page</li>
                    <li>Click <strong>"Connect LinkedIn"</strong></li>
                    <li>Connect any LinkedIn account (personal or company)</li>
                  </ol>
                  
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-800 text-xs">
                      <strong>✓ Benefit:</strong> Use your personal Google for calendar access, 
                      and connect your company LinkedIn for posting business content!
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => signIn('google')}
                    className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google First
                  </button>
                  
                  <button
                    onClick={() => setShowLinkedInInfo(false)}
                    className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Got it, Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}