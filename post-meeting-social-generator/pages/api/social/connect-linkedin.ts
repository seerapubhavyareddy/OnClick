// pages/api/social/connect-linkedin.ts - New endpoint for LinkedIn connections
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Generate LinkedIn connection URL
    try {
      const session = await getServerSession(req, res, authOptions)
      
      if (!session?.user?.email) {
        return res.status(401).json({ error: 'Must be signed in with Google first' })
      }

      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      })

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Generate LinkedIn OAuth URL for connection (not authentication)
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const clientId = process.env.LINKEDIN_CLIENT_ID!
      
      const state = JSON.stringify({
        action: 'connect_social',
        userId: user.id,
        platform: 'linkedin'
      })

      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', `${baseUrl}/api/social/linkedin-callback`)
      authUrl.searchParams.set('scope', 'openid profile email')
      authUrl.searchParams.set('state', state)

      return res.json({ 
        success: true,
        authUrl: authUrl.toString(),
        message: 'Redirect to LinkedIn to connect account for posting'
      })

    } catch (error) {
      console.error('Error generating LinkedIn connection URL:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  } else if (req.method === 'DELETE') {
    // Disconnect LinkedIn
    try {
      const session = await getServerSession(req, res, authOptions)
      
      if (!session?.user?.email) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      })

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Remove LinkedIn connection
      await prisma.socialAccount.deleteMany({
        where: {
          userId: user.id,
          platform: 'linkedin'
        }
      })

      return res.json({ 
        success: true, 
        message: 'LinkedIn disconnected successfully' 
      })

    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.setHeader('Allow', ['POST', 'DELETE'])
    res.status(405).json({ error: 'Method not allowed' })
  }
}