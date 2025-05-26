// src/app/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { SettingsIcon, LinkIcon, CheckCircleIcon, XCircleIcon, CalendarIcon } from 'lucide-react'

interface SocialAccount {
  platform: string
  profileData: any
  createdAt: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchSocialAccounts()
    }
  }, [session])

  const fetchSocialAccounts = async () => {
    try {
      const response = await fetch('/api/social/accounts')
      if (response.ok) {
        const accounts = await response.json()
        setSocialAccounts(accounts)
      }
    } catch (error) {
      console.error('Error fetching social accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectSocialAccount = async (provider: string) => {
    setConnecting(provider)
    try {
      // Redirect to OAuth provider
      await signIn(provider, { 
        callbackUrl: '/settings?connected=' + provider 
      })
    } catch (error) {
      console.error(`Error connecting ${provider}:`, error)
      setConnecting(null)
    }
  }

  const disconnectSocialAccount = async (platform: string) => {
    try {
      const response = await fetch('/api/social/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      })

      if (response.ok) {
        setSocialAccounts(accounts => 
          accounts.filter(account => account.platform !== platform)
        )
      } else {
        alert('Failed to disconnect account')
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
                  onClick={() => connectSocialAccount('linkedin')}
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
                    <p className="text-green-800 text-sm font-medium">✓ Connected</p>
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
                  onClick={() => connectSocialAccount('facebook')}
                  disabled={connecting === 'facebook'}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {connecting === 'facebook' ? 'Connecting...' : 'Connect Facebook'}
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