// pages/api/auth/[...nextauth].ts - with offline access for refresh tokens
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '../../../lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',  // This is crucial for refresh tokens
          prompt: 'consent',       // Forces consent screen to get refresh token
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔑 SignIn callback triggered')
      console.log('👤 User:', { id: user.id, email: user.email, name: user.name })
      console.log('🔗 Account:', { 
        provider: account?.provider, 
        providerAccountId: account?.providerAccountId,
        type: account?.type,
        access_token: account?.access_token ? 'exists' : 'missing',
        refresh_token: account?.refresh_token ? 'exists' : 'missing'  // Log this too
      })
      console.log('📝 Profile:', { id: profile?.sub, email: profile?.email })
      return true
    },
    async session({ session, user }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      }
    },
  },
  events: {
    async createUser(message) {
      console.log('👤 User created:', message.user.email)
    },
    async linkAccount(message) {
      console.log('🔗 Account linked:', message.account.provider, 'to user:', message.user.email)
      console.log('🔑 Refresh token present:', !!message.account.refresh_token)
    },
  },
  debug: true,
}

export default NextAuth(authOptions)