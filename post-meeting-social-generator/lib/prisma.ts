// lib/prisma.ts - EMERGENCY FIX for Supabase connection issues
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// EMERGENCY: Single connection configuration for Supabase
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
  // Remove datasources configuration to prevent connection issues
})

// Only store in global during development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Ensure cleanup
const cleanup = async () => {
  try {
    await prisma.$disconnect()
    console.log('🔌 Prisma disconnected')
  } catch (error) {
    console.error('Error disconnecting Prisma:', error)
  }
}

// Handle process termination
process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('SIGHUP', cleanup)