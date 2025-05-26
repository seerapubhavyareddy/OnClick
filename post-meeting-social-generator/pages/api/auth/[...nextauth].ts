// pages/api/auth/[...nextauth].ts - FINAL PRODUCTION VERSION
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
    // PRIMARY AUTHENTICATION: Google only
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
    
    // SOCIAL POSTING TOOL: LinkedIn (not for authentication)
    {
      id: "linkedin",
      name: "LinkedIn",
      type: "oauth",
      issuer: "https://www.linkedin.com",
      wellKnown: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
      authorization: {
        url: 'https://www.linkedin.com/oauth/v2/authorization',
        params: {
          scope: 'openid profile email',
          response_type: 'code',
        },
      },
      token: {
        url: "https://www.linkedin.com/oauth/v2/accessToken",
        params: {
          grant_type: 'authorization_code',
        },
        request: async (context: any) => {
          const { provider, params } = context;
          
          const bodyParams: Record<string, string> = {
            grant_type: 'authorization_code',
            client_id: provider.clientId || '',
            client_secret: provider.clientSecret || '',
            code: params.code || '',
            redirect_uri: provider.callbackUrl || '',
          };
          
          const body = new URLSearchParams(bodyParams);
          const response = await fetch(provider.token.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: body.toString(),
          });

          const tokens = await response.json();
          if (!response.ok) {
            throw new Error(`LinkedIn token error: ${tokens.error_description || tokens.error}`);
          }
          return { tokens };
        },
      },
      userinfo: {
        url: 'https://api.linkedin.com/v2/userinfo',
      },
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      client: {
        token_endpoint_auth_method: "client_secret_post",
        id_token_signed_response_alg: "RS256",
      },
      profile(profile: any) {
        console.log('🟦 LinkedIn profile received for connection:', JSON.stringify(profile, null, 2));
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
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
    
    // CRITICAL: Block LinkedIn as authentication, allow only Google
    async signIn({ user, account }) {
      console.log(`🔑 SignIn attempt: ${user.email} via ${account?.provider}`)
      
      if (!user.email || !account) {
        return false
      }
      
      // BLOCK LinkedIn direct sign-in
      if (account.provider === 'linkedin') {
        console.log(`🚫 LinkedIn blocked: Not for authentication, use Google first`)
        return false
      }
      
      // ALLOW Google authentication
      if (account.provider === 'google') {
        console.log(`✅ Google authentication allowed: ${user.email}`)
        return true
      }
      
      // Block all others
      return false
    },
    
    async redirect({ url, baseUrl }) {
      // Redirect LinkedIn attempts to info page
      if (url.includes('/api/auth/callback/linkedin') || 
          url.includes('error=AccessDenied') || 
          url.includes('error=OAuthAccountNotLinked')) {
        return `${baseUrl}/?linkedin_info=true`
      }
      
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  
  debug: false,
}

export default NextAuth(authOptions)