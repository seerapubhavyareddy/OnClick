// test-recall.js
const axios = require('axios')

async function testRecallAPI() {
  const API_KEY = process.env.RECALL_API_KEY || 'a9020bfae28aaf581cf44b9f8fafb7b1b6432323'
  const API_URL = process.env.RECALL_API_URL || 'https://us-east-1.recall.ai/api/v1'
  
  console.log('Testing Recall.ai API...')
  console.log('API URL:', API_URL)
  console.log('API Key exists:', !!API_KEY)
  console.log('API Key starts with:', API_KEY?.substring(0, 10))
  
  try {
    // Test 1: List bots (should work with valid credentials)
    const response = await axios.get(`${API_URL}/bot`, {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    })
    
    console.log('✅ API Test Success!')
    console.log('Response status:', response.status)
    console.log('Bots found:', response.data?.results?.length || 0)
    
  } catch (error) {
    console.error('❌ API Test Failed:')
    console.error('Status:', error.response?.status)
    console.error('Error:', error.response?.data || error.message)
    console.error('URL attempted:', error.config?.url)
  }
}

testRecallAPI()