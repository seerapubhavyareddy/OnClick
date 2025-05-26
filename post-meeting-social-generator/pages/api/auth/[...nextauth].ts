// pages/api/auth/[...nextauth].ts - CLEAN VERSION (Google auth only)
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
    // ONLY Google for authentication
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
    // NO LinkedIn provider here - we handle it separately
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
    
    async redirect({ url, baseUrl }) {
      console.log(`🔄 NextAuth redirect called:`, { url, baseUrl })
      
      // Default redirect handling
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  
  pages: {
    signIn: '/api/auth/signin',
    error: '/api/auth/error',
  },
  
  debug: process.env.NODE_ENV === 'development',
}

export default NextAuth(authOptions)