// lib/user-validation.ts - Strict user validation utility
import { prisma } from './prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../pages/api/auth/[...nextauth]'

export async function validateCurrentUser() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email || !session?.user?.id) {
      throw new Error('No valid session found')
    }
    
    // CRITICAL: Verify the user exists with matching email and ID
    const user = await prisma.user.findUnique({
      where: { 
        id: session.user.id,
        email: session.user.email // Double validation
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true
      }
    })
    
    if (!user) {
      console.error(`🚨 USER VALIDATION FAILED: No user found with ID ${session.user.id} and email ${session.user.email}`)
      throw new Error('User validation failed - ID/email mismatch')
    }
    
    if (user.email !== session.user.email) {
      console.error(`🚨 EMAIL MISMATCH: DB has ${user.email}, session has ${session.user.email}`)
      throw new Error('Email validation failed')
    }
    
    console.log(`✅ User validated: ${user.email} (ID: ${user.id})`)
    
    return {
      user,
      session
    }
    
  } catch (error) {
    console.error('❌ User validation error:', error)
    throw error
  }
}

// Use this in all API endpoints instead of individual validation
export async function withUserValidation<T>(
  handler: (user: any, session: any) => Promise<T>
): Promise<T> {
  const { user, session } = await validateCurrentUser()
  return handler(user, session)
}