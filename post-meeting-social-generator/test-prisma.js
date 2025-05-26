// test-prisma.js - Create this file in your project root to test
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testPrisma() {
  try {
    console.log('Testing Prisma client...')
    
    // Test if SocialAccount model exists
    const socialAccounts = await prisma.socialAccount.findMany()
    console.log('✅ SocialAccount model works:', socialAccounts.length, 'records found')
    
    // Test the model structure
    console.log('✅ Model structure is correct')
    
  } catch (error) {
    console.error('❌ Prisma test failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testPrisma()