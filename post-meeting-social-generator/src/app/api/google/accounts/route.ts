// src/app/api/google/accounts/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../pages/api/auth/[...nextauth]'
import { multipleAccountCalendarService } from '../../../../../lib/multiple-calendar-service'
import { prisma } from '../../../../../lib/prisma'

// GET - Fetch user's Google accounts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's Google accounts
    const googleAccounts = await multipleAccountCalendarService.getUserGoogleAccounts(user.id)

    console.log(`📋 Found ${googleAccounts.length} Google accounts for user: ${user.email}`)

    return NextResponse.json(googleAccounts.map(account => ({
      ...account,
      createdAt: account.createdAt.toISOString()
    })))

  } catch (error) {
    console.error('Error fetching Google accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a Google account
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has more than one Google account
    const accountCount = await prisma.googleAccount.count({
      where: { userId: user.id }
    })

    if (accountCount <= 1) {
      return NextResponse.json({ 
        error: 'Cannot remove your last Google account' 
      }, { status: 400 })
    }

    // Remove the Google account
    const success = await multipleAccountCalendarService.removeGoogleAccount(user.id, email)

    if (success) {
      console.log(`✅ Removed Google account: ${email} for user: ${user.email}`)
      return NextResponse.json({ 
        success: true, 
        message: `Google account ${email} removed successfully` 
      })
    } else {
      return NextResponse.json({ 
        error: 'Google account not found' 
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Error removing Google account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}