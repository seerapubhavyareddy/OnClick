// types/next-auth.d.ts - Updated with Google account types
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      socialAccounts?: Array<{
        platform: string
        profileData: any
        createdAt: string
      }>
      googleAccounts?: Array<{
        id: string
        email: string
        name?: string | null
        image?: string | null
        isPrimary: boolean
        createdAt: string
      }>
    }
  }
  
  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
  }
}