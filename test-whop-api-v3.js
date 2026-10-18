// Test script to fetch Whop app data directly
// Focusing on public API endpoints and app-specific data

// API credentials
const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_APP_ID = 'app_L3qVLiVTyjKR8D';
const WHOP_AGENT_USER_ID = 'user_v1zpj38VHwKaj';

// Helper function to make API requests
async function makeWhopRequest(url, params = {}, additionalHeaders = {}) {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const fullUrl = queryParams ? `${url}?${queryParams}` : url;
    
    console.log(`Trying endpoint: ${fullUrl}`);
    
    const headers = {
      'Authorization': `Bearer ${WHOP_API_KEY}`,
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers
    });

    console.log(`Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error ${response.status}: ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Request error:', error);
    return { success: false, error: error.message };
  }
}

// Test different endpoints focusing on public APIs and app info
async function testWhopAPI() {
  console.log('=== TESTING WHOP PUBLIC API ENDPOINTS ===\n');

  // 1. Try getting the app directly
  console.log('\n--- TEST 1: Get App Info ---');
  const appResult = await makeWhopRequest(`https://api.whop.com/api/v4/apps/${WHOP_APP_ID}`);
  if (appResult.success) {
    console.log('App Info:', JSON.stringify(appResult.data, null, 2));
  }

  // 2. Try getting the experience info for the app
  console.log('\n--- TEST 2: Get Experience Info ---');
  const experienceResult = await makeWhopRequest('https://api.whop.com/api/v5/app/experiences');
  if (experienceResult.success) {
    console.log('Experiences Count:', experienceResult.data.pagination?.total_count ?? 0);
    console.log('Experiences Data:', JSON.stringify(experienceResult.data.data, null, 2));
  }

  // 3. Try getting installations
  console.log('\n--- TEST 3: Get Installations ---');
  const installsResult = await makeWhopRequest('https://api.whop.com/api/v5/app/installations');
  if (installsResult.success) {
    console.log('Installations Count:', installsResult.data.pagination?.total_count ?? 0);
    console.log('Installations Data:', installsResult.data.data?.length > 0 ? 
      JSON.stringify(installsResult.data.data.slice(0, 2), null, 2) : 'No data');
  }

  // 4. Try public app view endpoint
  console.log('\n--- TEST 4: Public App View ---');
  const publicAppResult = await makeWhopRequest(`https://api.whop.com/api/v2/apps/${WHOP_APP_ID}/view`);
  if (publicAppResult.success) {
    console.log('Public App View:', JSON.stringify(publicAppResult.data, null, 2));
  }

  // 5. Try to get app stats
  console.log('\n--- TEST 5: App Stats ---');
  const statsResult = await makeWhopRequest('https://api.whop.com/api/v5/app/stats');
  if (statsResult.success) {
    console.log('App Stats:', JSON.stringify(statsResult.data, null, 2));
  }
  
  // 6. Try to get company profile for ai-innovation
  console.log('\n--- TEST 6: Company Profile ---');
  const companyResult = await makeWhopRequest('https://api.whop.com/api/v2/companies/ai-innovation');
  if (companyResult.success) {
    console.log('Company Profile:', JSON.stringify(companyResult.data, null, 2));
  }
  
  // 7. Try to access website metadata for ai-innovation
  console.log('\n--- TEST 7: Website Metadata ---');
  // This tries to access the page at https://whop.com/ai-innovation/ to get member count
  await fetch('https://whop.com/ai-innovation/')
    .then(response => {
      console.log('Website Status:', response.status);
      return response.text();
    })
    .then(html => {
      // Look for member count in the HTML
      const memberMatch = html.match(/(\d+)\s+members/i);
      if (memberMatch) {
        console.log('Member Count from Website:', memberMatch[1]);
      } else {
        console.log('Member count not found in website HTML');
      }
      
      // Check for metadata in the page
      const metaTags = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:([^"]+)"[^>]*>/g);
      if (metaTags) {
        console.log('Found metadata tags:', metaTags.length);
        metaTags.forEach(tag => {
          console.log(tag);
        });
      }
    })
    .catch(error => {
      console.error('Error fetching website:', error);
    });
  
  console.log('\n=== TESTING COMPLETE ===');
}

// Execute the tests
testWhopAPI();
