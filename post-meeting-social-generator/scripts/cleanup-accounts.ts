// scripts/cleanup-for-production.ts
// Run this before deployment: npx tsx scripts/cleanup-for-production.ts

import fs from 'fs'
import path from 'path'

async function cleanupForProduction() {
  console.log('🧹 Cleaning up project for production deployment...')
  
  const filesToRemove = [
    // Debug/test files
    'pages/api/debug',
    'pages/api/test',
    'pages/api/troubleshoot',
    
    // Scripts (keep essential ones)
    'scripts/cleanup-accounts.ts',
    'scripts/simple-cleanup.ts',
    'scripts/fix-linkedin-linking.ts',
  ]
  
  const filesToCleanup = [
    // NextAuth config - remove debug logs
    'pages/api/auth/[...nextauth].ts',
    
    // Main page - remove debug imports
    'src/app/page.tsx',
    
    // Various API routes
    'src/app/api/ai/generate/route.ts',
    'src/app/api/calendar/events/route.ts',
    'src/app/api/meetings/toggle-notetaker/route.ts',
  ]
  
  try {
    // Remove debug/test directories and files
    for (const file of filesToRemove) {
      const fullPath = path.join(process.cwd(), file)
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        
        if (stats.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true })
          console.log(`🗑️  Removed directory: ${file}`)
        } else {
          fs.unlinkSync(fullPath)
          console.log(`🗑️  Removed file: ${file}`)
        }
      }
    }
    
    // Clean up specific files (remove debug logs, etc.)
    await cleanupNextAuthConfig()
    await cleanupMainPage()
    
    console.log('✅ Production cleanup completed!')
    console.log('\n📋 Next steps:')
    console.log('1. Update environment variables for production')
    console.log('2. Update OAuth redirect URLs')
    console.log('3. Test build: npm run build')
    console.log('4. Commit and push to git')
    console.log('5. Deploy to production')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

async function cleanupNextAuthConfig() {
  const configPath = 'pages/api/auth/[...nextauth].ts'
  
  if (!fs.existsSync(configPath)) return
  
  let content = fs.readFileSync(configPath, 'utf8')
  
  // Set debug to false for production
  content = content.replace(
    'debug: process.env.NODE_ENV === \'development\'',
    'debug: false'
  )
  
  // Remove excessive console.log statements but keep important ones
  content = content.replace(/console\.log\('🔄[^']*'\);?\n?/g, '')
  content = content.replace(/console\.log\('📨[^']*'\);?\n?/g, '')
  
  fs.writeFileSync(configPath, content)
  console.log('🔧 Cleaned up NextAuth configuration')
}

async function cleanupMainPage() {
  const pagePath = 'src/app/page.tsx'
  
  if (!fs.existsSync(pagePath)) return
  
  let content = fs.readFileSync(pagePath, 'utf8')
  
  // Remove app-initializer import if it exists
  content = content.replace(/import '.*app-initializer.*'\n/, '')
  
  // Remove debug console.logs
  content = content.replace(/console\.log\('📊[^']*'\);?\n?/g, '')
  content = content.replace(/console\.log\('🔄[^']*'\);?\n?/g, '')
  
  fs.writeFileSync(pagePath, content)
  console.log('🔧 Cleaned up main page')
}

// Generate production-ready package.json scripts
function updatePackageJsonScripts() {
  const packagePath = 'package.json'
  
  if (!fs.existsSync(packagePath)) return
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  // Add production-specific scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    'build:prod': 'prisma generate && next build',
    'start:prod': 'next start',
    'deploy:check': 'npm run build:prod && npm run start:prod',
  }
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
  console.log('📦 Updated package.json with production scripts')
}

cleanupForProduction().catch(console.error)