// pages/api/auth/[...nextauth].ts - FIXED with correct domain handling
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '../../../lib/prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  
  adapter: PrismaAdapter(prisma),
  
  providers: [
    // ONLY Google for authentication - NO LinkedIn here
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.userEmail = user.email
        token.userName = user.name
        token.userImage = user.image
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string
        session.user.email = token.userEmail as string
        session.user.name = token.userName as string
        session.user.image = token.userImage as string
        
        // Fetch social accounts for the session
        try {
          const socialAccounts = await prisma.socialAccount.findMany({
            where: { userId: token.userId as string },
            select: { 
              platform: true, 
              profileData: true,
              createdAt: true 
            }
          })
          
          session.user.socialAccounts = socialAccounts.map(account => ({
            ...account,
            createdAt: account.createdAt.toISOString()
          }))
        } catch (error) {
          console.error('Error fetching social accounts:', error)
          session.user.socialAccounts = []
        }
      }
      return session
    },
    
    // Simple sign-in handler - Google only
    async signIn({ user, account }) {
      console.log(`🔑 SignIn: ${user.email} via ${account?.provider}`)
      
      if (account?.provider === 'google') {
        console.log(`✅ Google authentication: ${user.email}`)
        return true
      }
      
      // Reject any other providers
      console.log(`❌ Rejected sign-in via: ${account?.provider}`)
      return false
    },
    
    // FIXED: Proper redirect callback with correct domain handling
    async redirect({ url, baseUrl }) {
      console.log(`🔄 NextAuth redirect called:`, { url, baseUrl })
      
      // FORCE the correct production domain
      const correctBaseUrl = 'https://post-meeting-social-generator.vercel.app'
      
      // Don't handle LinkedIn callbacks - let our custom handler deal with it
      if (url.includes('/api/social/linkedin-callback')) {
        console.log(`🟦 Ignoring LinkedIn callback redirect`)
        return correctBaseUrl
      }
      
      // Always use the correct domain for redirects
      if (url.startsWith("/")) {
        const redirectUrl = `${correctBaseUrl}${url}`
        console.log(`🔄 Redirecting to: ${redirectUrl}`)
        return redirectUrl
      }
      
      // If it's a full URL, check if it's our domain
      try {
        const urlObj = new URL(url)
        if (urlObj.hostname.includes('post-meeting-social-generator')) {
          // Force our correct domain
          urlObj.hostname = 'post-meeting-social-generator.vercel.app'
          const correctedUrl = urlObj.toString()
          console.log(`🔄 Corrected URL: ${correctedUrl}`)
          return correctedUrl
        }
      } catch (e) {
        // If URL parsing fails, fall back to correct base URL
        console.log(`🔄 URL parsing failed, using base: ${correctBaseUrl}`)
        return correctBaseUrl
      }
      
      console.log(`🔄 Default redirect: ${correctBaseUrl}`)
      return correctBaseUrl
    },
  },
  
  pages: {
    signIn: '/api/auth/signin',
    error: '/api/auth/error',
  },
  
  debug: false, // Turn off debug in production
}

export default NextAuth(authOptions)