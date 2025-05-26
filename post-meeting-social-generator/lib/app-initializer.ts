// lib/app-initializer.ts
import { pollingService } from './polling-service'

class AppInitializer {
  private initialized = false

  async initialize() {
    if (this.initialized) return

    try {
      console.log('🚀 Initializing application services...')
      
      // Start the polling service
      await pollingService.startPolling()
      
      this.initialized = true
      console.log('✅ Application services initialized')
    } catch (error) {
      console.error('❌ Failed to initialize application services:', error)
    }
  }
}

export const appInitializer = new AppInitializer()

// Auto-initialize when this module is imported
if (typeof window === 'undefined') {
  // Only run on server-side
  appInitializer.initialize()
}