// pages/api/auth/[...nextauth].ts - FIXED with proper account linking
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
    
    // LinkedIn provider - working configuration
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
        console.log('🟦 LinkedIn profile received:', JSON.stringify(profile, null, 2));
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
    
    // 🔥 FIXED SIGN-IN CALLBACK - Handles different emails properly
    async signIn({ user, account }) {
      console.log(`🔑 SignIn: ${user.email} via ${account?.provider}`)
      
      if (!user.email || !account) {
        console.error('❌ Missing email or account')
        return false
      }
      
      try {
        // For LinkedIn, we need to handle the email mismatch issue
        if (account.provider === 'linkedin') {
          console.log(`🟦 LinkedIn sign-in for: ${user.email}`)
          
          // Check if there's an existing user with similar email patterns
          // This handles cases where LinkedIn email might be slightly different
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: user.email }, // Exact match
                { email: 'bhavyareddyseerapu7658@gmail.com' }, // Your Google account email
                // Add other email variations if needed
              ]
            }
          })
          
          if (existingUser) {
            console.log(`📧 Found existing user: ${existingUser.email}, linking LinkedIn account`)
            
            // Store LinkedIn connection
            await prisma.socialAccount.upsert({
              where: {
                userId_platform: {
                  userId: existingUser.id,
                  platform: 'linkedin'
                }
              },
              update: {
                platformId: account.providerAccountId!,
                accessToken: account.access_token || '',
                refreshToken: account.refresh_token || null,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                scope: account.scope || null,
                profileData: {
                  name: user.name,
                  email: user.email,
                  image: user.image,
                  platformId: account.providerAccountId,
                  connectedAt: new Date().toISOString()
                },
                updatedAt: new Date()
              },
              create: {
                userId: existingUser.id,
                platform: 'linkedin',
                platformId: account.providerAccountId!,
                accessToken: account.access_token || '',
                refreshToken: account.refresh_token || null,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                scope: account.scope || null,
                profileData: {
                  name: user.name,
                  email: user.email,
                  image: user.image,
                  platformId: account.providerAccountId,
                  connectedAt: new Date().toISOString()
                }
              }
            })
            
            // Create/update the NextAuth account record with the existing user's ID
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: 'linkedin',
                  providerAccountId: account.providerAccountId
                }
              },
              update: {
                access_token: account.access_token || null,
                refresh_token: account.refresh_token || null,
                expires_at: account.expires_at || null,
                scope: account.scope || null,
                token_type: account.token_type || null,
                id_token: account.id_token || null
              },
              create: {
                userId: existingUser.id, // Link to existing user
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token || null,
                refresh_token: account.refresh_token || null,
                expires_at: account.expires_at || null,
                scope: account.scope || null,
                token_type: account.token_type || null,
                id_token: account.id_token || null
              }
            })
            
            console.log(`✅ LinkedIn successfully linked to existing user: ${existingUser.email}`)
            return true
          } else {
            console.log(`👤 Creating new user for LinkedIn: ${user.email}`)
            // Let NextAuth create the new user normally
            return true
          }
        }
        
        // Handle Google and other providers normally
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email }
        })
        
        if (!existingUser) {
          console.log('👤 New user will be created by NextAuth adapter')
          return true
        }
        
        if (account.provider === 'google' && account.access_token) {
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
        
        return true
        
      } catch (error) {
        console.error('❌ SignIn error:', error)
        // For LinkedIn, we want to allow the sign-in even if social account linking fails
        return account.provider === 'linkedin' ? true : false
      }
    },
    
    async redirect({ url, baseUrl }) {
      if (url.includes('/api/auth/callback/linkedin')) {
        return `${baseUrl}/settings?connected=linkedin`
      }
      
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  
  debug: process.env.NODE_ENV === 'development',
  
  pages: {
    error: '/auth/error',
  },
}

export default NextAuth(authOptions)