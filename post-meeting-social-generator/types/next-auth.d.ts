// types/next-auth.d.ts - Create this file in your project root or types folder
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