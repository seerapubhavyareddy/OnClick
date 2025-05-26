// pages/api/auth/[...nextauth].ts - WITH LINKEDIN RESTORED
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '../../../lib/prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt', // Use JWT to minimize DB calls
  },
  
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
    // LinkedIn provider - restored with proper configuration
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
        request: async (context: any) => {
          const { provider, params } = context;
          const url = new URL(provider.token.url);
          
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
        
        // Fetch social accounts for the session (but only when needed)
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
    
    async signIn({ user, account }) {
      console.log(`🔑 SignIn: ${user.email} via ${account?.provider}`)
      
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        })
        
        if (!existingUser) {
          console.log('👤 New user will be created by NextAuth adapter')
          return true
        }
        
        if (account && account.provider === 'google' && account.access_token) {
          // Update user info from Google
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: user.name,
              image: user.image,
              updatedAt: new Date()
            }
          })
          console.log(`✅ Google user updated: ${user.email}`)
        }
        
        if (account && account.provider === 'linkedin' && account.access_token) {
          console.log(`🟦 Processing LinkedIn connection for: ${user.email}`)
          
          const cleanProfileData = {
            name: user.name || null,
            email: user.email || null,
            image: user.image || null,
            platformId: account.providerAccountId,
            connectedAt: new Date().toISOString()
          }
          
          // Store LinkedIn connection in SocialAccount table
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

          console.log(`✅ LinkedIn connected successfully for: ${user.email}`)
        }
        
      } catch (error) {
        console.error('SignIn error:', error)
        // Don't fail login
      }
      
      return true
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
  
  debug: false,
}

export default NextAuth(authOptions)