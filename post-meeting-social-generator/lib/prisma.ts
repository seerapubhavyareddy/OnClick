// lib/prisma.ts - Optimized for Supabase
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Supabase-optimized configuration
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Disable connection pooling in development for Supabase
  // Supabase handles pooling on their end
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// Important: Don't reuse connections in development with Supabase
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Ensure proper cleanup
const cleanup = async () => {
  await prisma.$disconnect()
}

// Graceful shutdown handlers
process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)