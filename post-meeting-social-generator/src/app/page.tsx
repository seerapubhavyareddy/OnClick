// app/page.tsx - Updated with Basic Calendar Integration
'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { CalendarIcon, SettingsIcon, CheckCircleIcon, ClockIcon, UsersIcon, LinkIcon } from 'lucide-react'

// Mock calendar events for Phase 1 basic UI
const mockCalendarEvents = [
  {
    id: '1',
    title: 'Client Portfolio Review',
    startTime: '2025-01-15T10:00:00',
    endTime: '2025-01-15T11:00:00',
    attendees: ['john@client.com', 'sarah@client.com'],
    meetingUrl: 'https://zoom.us/j/123456789',
    platform: 'zoom',
    noteTakerEnabled: false
  },
  {
    id: '2',
    title: 'Team Strategy Meeting',
    startTime: '2025-01-15T14:00:00',
    endTime: '2025-01-15T15:30:00',
    attendees: ['team@company.com'],
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/123',
    platform: 'teams',
    noteTakerEnabled: true
  },
  {
    id: '3',
    title: 'Financial Planning Session',
    startTime: '2025-01-16T09:00:00',
    endTime: '2025-01-16T10:00:00',
    attendees: ['advisor@firm.com', 'client@email.com'],
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    platform: 'meet',
    noteTakerEnabled: false
  }
]

const mockPastMeetings = [
  {
    id: 'past-1',
    title: 'Q4 Investment Review',
    startTime: '2025-01-10T15:00:00',
    platform: 'zoom',
    status: 'completed',
    hasTranscript: true,
    hasEmail: true,
    socialPosts: 2
  }
]

export default function Home() {
  const { data: session, status } = useSession()
  const [calendarEvents, setCalendarEvents] = useState(mockCalendarEvents)

  const toggleNoteTaker = (eventId: string) => {
    setCalendarEvents(events => 
      events.map(event => 
        event.id === eventId 
          ? { ...event, noteTakerEnabled: !event.noteTakerEnabled }
          : event
      )
    )
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'zoom': return 'bg-blue-100 text-blue-800'
      case 'teams': return 'bg-purple-100 text-purple-800'
      case 'meet': return 'bg-green-100 text-green-800'
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
        {/* Phase 1 Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Phase 1: Foundation Setup ✅
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Next.js Setup</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Database Connected</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Google OAuth</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Basic Calendar UI</span>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Upcoming Meetings</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {calendarEvents.map(event => (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
                    {event.title}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={event.noteTakerEnabled}
                        onChange={() => toggleNoteTaker(event.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600">Note Taker</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    {formatDateTime(event.startTime)}
                  </div>
                  
                  <div className="flex items-center">
                    <UsersIcon className="h-4 w-4 mr-2" />
                    {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                  </div>

                  <div className="flex items-center">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${getPlatformColor(event.platform)}`}>
                      {event.platform}
                    </span>
                  </div>
                </div>

                {event.noteTakerEnabled && (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-800 text-sm font-medium">
                      ✓ Note taker will join this meeting
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Past Meetings */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Past Meetings</h2>
          <div className="space-y-4">
            {mockPastMeetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                    <p className="text-sm text-gray-500">{formatDateTime(meeting.startTime)}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${getPlatformColor(meeting.platform)}`}>
                      {meeting.platform}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {meeting.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <h4 className="font-medium text-gray-900 mb-1">View Transcript</h4>
                    <p className="text-sm text-gray-500">
                      {meeting.hasTranscript ? 'Available' : 'Processing...'}
                    </p>
                  </button>

                  <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <h4 className="font-medium text-gray-900 mb-1">Follow-up Email</h4>
                    <p className="text-sm text-gray-500">
                      {meeting.hasEmail ? 'Generated' : 'In progress...'}
                    </p>
                  </button>

                  <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                    <h4 className="font-medium text-gray-900 mb-1">Social Posts</h4>
                    <p className="text-sm text-gray-500">
                      {meeting.socialPosts} post{meeting.socialPosts !== 1 ? 's' : ''} generated
                    </p>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            User Information
          </h3>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {session.user?.name}</p>
            <p><span className="font-medium">Email:</span> {session.user?.email}</p>
            <p><span className="font-medium">Status:</span> Authenticated ✅</p>
            <p><span className="font-medium">Phase 1:</span> Complete ✅</p>
          </div>
        </div>
      </main>
    </div>
  )
}