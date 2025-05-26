// src/app/settings/page.tsx - Complete file with Suspense fix
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { SettingsIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, PlusIcon, TrashIcon } from 'lucide-react'

interface GoogleAccount {
  id: string
  email: string
  name?: string | null
  image?: string | null
  isPrimary: boolean
  createdAt: string
}

interface SocialAccount {
  platform: string
  profileData: any
  createdAt: string
}

// Component that uses useSearchParams - wrapped in Suspense
function SettingsContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchAccounts()
    }
  }, [session])

  useEffect(() => {
    // Handle URL parameters for connection status - Fixed null check
    if (searchParams) {
      const connected = searchParams.get('connected')
      const error = searchParams.get('error')
      const email = searchParams.get('email')

      if (connected === 'google' && email) {
        setMessage(`✅ Google account ${email} connected successfully!`)
        setTimeout(() => setMessage(null), 5000)
      } else if (connected === 'linkedin') {
        setMessage(`✅ LinkedIn account connected successfully!`)
        setTimeout(() => setMessage(null), 5000)
      } else if (error) {
        const errorMessages = {
          oauth_failed: 'OAuth authentication failed',
          missing_params: 'Missing required parameters',
          invalid_state: 'Invalid request state',
          invalid_request: 'Invalid request',
          no_email: 'No email received from Google',
          callback_failed: 'Connection callback failed'
        }
        setMessage(`❌ ${errorMessages[error as keyof typeof errorMessages] || 'Connection failed'}`)
        setTimeout(() => setMessage(null), 5000)
      }
    }
  }, [searchParams])

  const fetchAccounts = async () => {
    try {
      // Fetch Google accounts
      const googleResponse = await fetch('/api/google/accounts')
      if (googleResponse.ok) {
        const accounts = await googleResponse.json()
        setGoogleAccounts(accounts)
      }

      // Fetch social accounts
      const socialResponse = await fetch('/api/social/accounts')
      if (socialResponse.ok) {
        const accounts = await socialResponse.json()
        setSocialAccounts(accounts)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const addGoogleAccount = async () => {
    setConnecting('google')
    try {
      const response = await fetch('/api/google/add-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        // Redirect to Google OAuth
        window.location.href = result.authUrl
      } else {
        const error = await response.json()
        alert(`Failed to add Google account: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding Google account:', error)
      alert('Failed to add Google account')
    } finally {
      setConnecting(null)
    }
  }

  const removeGoogleAccount = async (email: string) => {
    if (googleAccounts.length <= 1) {
      alert('Cannot remove your last Google account')
      return
    }

    if (!confirm(`Remove Google account ${email}?`)) return

    try {
      const response = await fetch('/api/google/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        setGoogleAccounts(accounts => 
          accounts.filter(account => account.email !== email)
        )
        setMessage(`✅ Google account ${email} removed successfully`)
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        alert(`Failed to remove account: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing Google account:', error)
      alert('Failed to remove Google account')
    }
  }

//   connectLinkedIn 
const connectLinkedIn = async () => {
  setConnecting('linkedin')
  try {
    // Use the NEW LinkedIn connection endpoint (NOT NextAuth)
    const response = await fetch('/api/social/connect-linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ LinkedIn connection URL generated:', result.authUrl)
      // Redirect to LinkedIn OAuth for connection (not authentication)
      window.location.href = result.authUrl
    } else {
      const error = await response.json()
      alert(`Failed to connect LinkedIn: ${error.error}`)
    }
  } catch (error) {
    console.error('Error connecting LinkedIn:', error)
    alert('Failed to connect LinkedIn')
  } finally {
    setConnecting(null)
  }
}

  // Keep mock connection for Facebook (demo mode)
  const connectMockSocialAccount = async (platform: string) => {
    setConnecting(platform)
    try {
      const response = await fetch('/api/social/mock-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      })

      if (response.ok) {
        await fetchAccounts()
        setMessage(`✅ Demo ${platform} account connected successfully!`)
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        alert(`Failed to connect ${platform}: ${error.error}`)
      }
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error)
      alert(`Failed to connect ${platform}`)
    } finally {
      setConnecting(null)
    }
  }

  const disconnectSocialAccount = async (platform: string) => {
  try {
    if (platform === 'linkedin') {
      // Use the NEW LinkedIn disconnect endpoint
      const response = await fetch('/api/social/connect-linkedin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        setSocialAccounts(accounts => 
          accounts.filter(account => account.platform !== platform)
        )
        setMessage(`✅ LinkedIn disconnected successfully`)
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        alert(`Failed to disconnect: ${error.error}`)
      }
    } else {
      // For other platforms, use the old method
      const response = await fetch('/api/social/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      })

      if (response.ok) {
        setSocialAccounts(accounts => 
          accounts.filter(account => account.platform !== platform)
        )
        setMessage(`✅ ${platform} account disconnected successfully`)
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        alert(`Failed to disconnect: ${error.error}`)
      }
    }
  } catch (error) {
    console.error('Error disconnecting account:', error)
    alert('Failed to disconnect account')
  }
}


  const isConnected = (platform: string) => {
    return socialAccounts.some(account => account.platform === platform)
  }

  const getAccountInfo = (platform: string) => {
    return socialAccounts.find(account => account.platform === platform)
  }

  if (status === 'loading' || loading) {
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
            <SettingsIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600 mb-8">Please sign in to access settings</p>
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
              <SettingsIcon className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="/"
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                ← Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Status Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message}
          </div>
        )}
        
        {/* Google Accounts */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Google Calendar Accounts
          </h2>
          <p className="text-gray-600 mb-6">
            Connect multiple Google accounts to access all your calendars.
          </p>

          <div className="space-y-4 mb-6">
            {googleAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  <img
                    src={account.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.name || account.email)}&background=4f46e5&color=ffffff`}
                    alt={account.name || account.email}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <div>
                    <div className="flex items-center">
                      <h3 className="text-sm font-medium text-gray-900">
                        {account.name || account.email}
                      </h3>
                      {account.isPrimary && (
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{account.email}</p>
                    <p className="text-xs text-gray-400">
                      Connected {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  {!account.isPrimary && (
                    <button
                      onClick={() => removeGoogleAccount(account.email)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Remove account"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addGoogleAccount}
            disabled={connecting === 'google'}
            className="flex items-center px-4 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {connecting === 'google' ? 'Connecting...' : 'Add Another Google Account'}
          </button>
        </div>

        {/* Social Media Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-center">
            <AlertCircleIcon className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="text-blue-800 font-medium">Social Media Integration</p>
              <p className="text-blue-700 text-sm">
                LinkedIn uses real OAuth. Facebook uses demo mode (requires additional business verification for posting).
              </p>
            </div>
          </div>
        </div>
        
        {/* Social Media Connections */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Social Media Connections
          </h2>
          <p className="text-gray-600 mb-6">
            Connect your social media accounts to automatically post meeting insights.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* LinkedIn */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">in</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">LinkedIn</h3>
                    <p className="text-sm text-gray-500">Professional networking</p>
                  </div>
                </div>
                
                {isConnected('linkedin') ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {isConnected('linkedin') ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-800 text-sm font-medium">✓ Connected</p>
                    {getAccountInfo('linkedin')?.profileData?.name && (
                      <p className="text-green-600 text-sm">
                        {getAccountInfo('linkedin')?.profileData?.name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => disconnectSocialAccount('linkedin')}
                    className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Disconnect LinkedIn
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectLinkedIn}
                  disabled={connecting === 'linkedin'}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {connecting === 'linkedin' ? 'Connecting...' : 'Connect LinkedIn'}
                </button>
              )}
            </div>

            {/* Facebook */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">f</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Facebook</h3>
                    <p className="text-sm text-gray-500">Social networking</p>
                  </div>
                </div>
                
                {isConnected('facebook') ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {isConnected('facebook') ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-green-800 text-sm font-medium">✓ Connected (Demo)</p>
                    {getAccountInfo('facebook')?.profileData?.name && (
                      <p className="text-green-600 text-sm">
                        {getAccountInfo('facebook')?.profileData?.name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => disconnectSocialAccount('facebook')}
                    className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Disconnect Facebook
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connectMockSocialAccount('facebook')}
                  disabled={connecting === 'facebook'}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {connecting === 'facebook' ? 'Connecting...' : 'Connect Facebook (Demo)'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bot Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Meeting Bot Settings
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bot Join Time
              </label>
              <select className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="5">5 minutes before meeting</option>
                <option value="3">3 minutes before meeting</option>
                <option value="1">1 minute before meeting</option>
                <option value="0">At meeting start time</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                How early should the note-taking bot join your meetings?
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Main component with Suspense wrapper
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}