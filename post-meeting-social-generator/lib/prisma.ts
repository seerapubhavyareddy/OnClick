// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma with reliable connection settings
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Add connection timeout and pool settings
    // especially important for serverless environments
    // to prevent exhausting connections
    // connectionLimit: 1
  })
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

// Only store prisma in global object during development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Handle prisma shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

// Handle unexpected termination
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})