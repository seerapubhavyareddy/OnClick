// pages/api/auth/[...nextauth].ts - Clean version (no inline types)
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '../../../lib/prisma'

export const authOptions: NextAuthOptions = {
  // Use session strategy to reduce database calls
  session: {
    strategy: 'jwt', // Use JWT instead of database sessions
  },
  
  // Still use Prisma adapter for user/account storage
  adapter: PrismaAdapter(prisma),
  
  providers: [
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
    // Custom LinkedIn provider with proper token configuration
    {
      id: "linkedin",
      name: "LinkedIn",
      type: "oauth",
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
        // Force client authentication via request body
        request: async (context: any) => {
          const { provider, params } = context;
          const url = new URL(provider.token.url);
          
          // Create body with proper type checking
          const bodyParams: Record<string, string> = {
            grant_type: 'authorization_code',
            client_id: provider.clientId || '',
            client_secret: provider.clientSecret || '',
            code: params.code || '',
            redirect_uri: provider.callbackUrl || '',
          };
          
          const body = new URLSearchParams(bodyParams);

          const response = await fetch(url, {
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
      profile(profile: any) {
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
      // Store user ID in JWT to reduce database lookups
      if (user) {
        token.userId = user.id
      }
      return token
    },
    
    async session({ session, token }) {
      // Add user ID from JWT
      if (session.user && token.userId) {
        session.user.id = token.userId as string
        
        // Fetch social accounts
        try {
          const socialAccounts = await prisma.socialAccount.findMany({
            where: { userId: token.userId as string },
            select: { 
              platform: true, 
              profileData: true,
              createdAt: true 
            }
          })
          
          // Convert Date objects to strings to match our type declaration
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
    
    async signIn({ user, account }) {
      console.log('🔑 SignIn callback triggered')
      
      try {
        // Handle LinkedIn connection
        if (account && account.provider === 'linkedin') {
          console.log(`🟦 Processing LinkedIn connection for: ${user.email}`)
          
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          })

          if (existingUser && account.access_token) {
            const cleanProfileData = {
              name: user.name || null,
              email: user.email || null,
              image: user.image || null,
              platformId: account.providerAccountId,
              connectedAt: new Date().toISOString()
            }
            
            await prisma.socialAccount.upsert({
              where: {
                userId_platform: {
                  userId: existingUser.id,
                  platform: account.provider
                }
              },
              update: {
                platformId: account.providerAccountId!,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                scope: account.scope,
                profileData: cleanProfileData
              },
              create: {
                userId: existingUser.id,
                platform: account.provider,
                platformId: account.providerAccountId!,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                scope: account.scope,
                profileData: cleanProfileData
              }
            })

            console.log(`✅ LinkedIn connected successfully!`)
          }
        }
        
        return true
      } catch (error) {
        console.error('❌ LinkedIn connection error:', error)
        return true
      }
    },
    
    async redirect({ url, baseUrl }) {
      // Handle LinkedIn OAuth callback redirect
      if (url.includes('/api/auth/callback/linkedin')) {
        return `${baseUrl}/settings?connected=linkedin`
      }
      
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  
  debug: true,
}

export default NextAuth(authOptions)