// pages/auth/error.tsx - Create this file for error handling
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { AlertCircleIcon, ArrowLeftIcon } from 'lucide-react'

const errors = {
  Configuration: 'There was a problem with the server configuration.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Verification: 'The sign in link is no longer valid. It may have been used already or expired.',
  Default: 'Unable to sign in.',
  OAuthAccountNotLinked: 'This account is already linked to another user. Please try signing in with your original provider.',
  EmailCreateAccount: 'Could not create account with this email.',
  OAuthCallback: 'OAuth callback error. Please try again.',
  OAuthCreateAccount: 'Could not create OAuth account.',
  SessionRequired: 'Please sign in to access this page.',
  Callback: 'OAuth callback error occurred.',
}

export default function AuthErrorPage() {
  const router = useRouter()
  const [error, setError] = useState<string>('')
  const [errorDetails, setErrorDetails] = useState<string>('')

  useEffect(() => {
    const errorType = router.query.error as string
    
    if (errorType) {
      const errorMessage = errors[errorType as keyof typeof errors] || errors.Default
      setError(errorMessage)
      
      // Set specific details for common errors
      if (errorType === 'OAuthAccountNotLinked') {
        setErrorDetails('This usually happens when you try to sign in with LinkedIn using an email that\'s already associated with a Google account (or vice versa). Please sign in with your original provider first.')
      } else if (errorType === 'OAuthCallback') {
        setErrorDetails('There was an issue with the OAuth callback. This might be due to configuration issues or network problems.')
      }
    }
  }, [router.query.error])

  const handleRetry = () => {
    router.push('/api/auth/signin')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <AlertCircleIcon className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authentication Error
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {error || 'An unexpected error occurred during sign in.'}
            </p>
            
            {errorDetails && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>What this means:</strong> {errorDetails}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={handleRetry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
            
            <button
              onClick={handleGoHome}
              className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Go Home
            </button>
          </div>

          {/* Debug information in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <h4 className="text-sm font-medium text-gray-900">Debug Info:</h4>
              <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                {JSON.stringify(router.query, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}