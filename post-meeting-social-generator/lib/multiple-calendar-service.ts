// lib/multiple-calendar-service.ts - Fixed with proper types
import { google } from 'googleapis'
import { prisma } from './prisma'
import { GoogleCalendarClient, CalendarEvent } from './google-calendar'
import type { GoogleAccountData, GoogleAccountInfo } from '../types/multiple-calendar'

export interface CalendarEventWithAccount extends CalendarEvent {
  accountEmail: string
  accountName?: string
}

export class MultipleAccountCalendarService {
  
  async getAllCalendarEvents(userId: string): Promise<CalendarEventWithAccount[]> {
    console.log(`📅 Fetching events from all Google accounts for user: ${userId}`)
    
    // Get all Google accounts for the user
    const googleAccounts = await prisma.googleAccount.findMany({
      where: { userId },
      orderBy: [
        { isPrimary: 'desc' }, // Primary account first
        { createdAt: 'asc' }   // Then by creation order
      ]
    })
    
    console.log(`🔍 Found ${googleAccounts.length} Google accounts`)
    
    const allEvents: CalendarEventWithAccount[] = []
    
    // Fetch events from each account
    for (const account of googleAccounts) {
      try {
        console.log(`📋 Fetching events from: ${account.email}`)
        
        const calendarClient = new GoogleCalendarClient(
          account.accessToken,
          account.refreshToken || undefined
        )
        
        const events = await calendarClient.getUpcomingEvents(20)
        
        // Add account information to each event
        const eventsWithAccount: CalendarEventWithAccount[] = events.map(event => ({
          ...event,
          accountEmail: account.email,
          accountName: account.name || undefined
        }))
        
        allEvents.push(...eventsWithAccount)
        console.log(`✅ Got ${events.length} events from ${account.email}`)
        
      } catch (error) {
        console.error(`❌ Error fetching events from ${account.email}:`, error)
        // Continue with other accounts
        continue
      }
    }
    
    // Sort all events by start time
    const sortedEvents = allEvents.sort((a, b) => 
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    )
    
    console.log(`🎯 Total events from all accounts: ${sortedEvents.length}`)
    return sortedEvents
  }
  
  async addGoogleAccount(userId: string, accountData: GoogleAccountData) {
    console.log(`➕ Adding Google account: ${accountData.email}`)
    
    // Check if this is the first Google account (make it primary)
    const existingAccounts = await prisma.googleAccount.count({
      where: { userId }
    })
    
    const isPrimary = existingAccounts === 0
    
    const googleAccount = await prisma.googleAccount.upsert({
      where: {
        userId_email: {
          userId,
          email: accountData.email
        }
      },
      update: {
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        expiresAt: accountData.expiresAt,
        name: accountData.name,
        image: accountData.image,
        accountId: accountData.accountId
      },
      create: {
        userId,
        email: accountData.email,
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        expiresAt: accountData.expiresAt,
        name: accountData.name,
        image: accountData.image,
        accountId: accountData.accountId,
        isPrimary
      }
    })
    
    console.log(`✅ Google account added: ${accountData.email} (Primary: ${isPrimary})`)
    return googleAccount
  }
  
  async removeGoogleAccount(userId: string, email: string) {
    console.log(`➖ Removing Google account: ${email}`)
    
    const deletedAccount = await prisma.googleAccount.deleteMany({
      where: {
        userId,
        email
      }
    })
    
    // If we deleted the primary account, make another one primary
    if (deletedAccount.count > 0) {
      const remainingAccounts = await prisma.googleAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      })
      
      if (remainingAccounts.length > 0 && !remainingAccounts.some((acc: any) => acc.isPrimary)) {
        await prisma.googleAccount.update({
          where: { id: remainingAccounts[0].id },
          data: { isPrimary: true }
        })
        console.log(`✅ Made ${remainingAccounts[0].email} the new primary account`)
      }
    }
    
    console.log(`✅ Google account removed: ${email}`)
    return deletedAccount.count > 0
  }
  
  async getUserGoogleAccounts(userId: string): Promise<GoogleAccountInfo[]> {
    const accounts = await prisma.googleAccount.findMany({
      where: { userId },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ],
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        isPrimary: true,
        createdAt: true
      }
    })
    
    return accounts.map(account => ({
      ...account,
      createdAt: account.createdAt
    }))
  }
}

export const multipleAccountCalendarService = new MultipleAccountCalendarService()