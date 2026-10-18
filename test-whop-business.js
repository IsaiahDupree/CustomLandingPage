// Focused test to get AI Innovation business data
// Trying both direct API and web scraping approaches
// Using only native fetch API (no external dependencies)

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

// Scrape website data
async function scrapeWhopWebsite() {
  try {
    console.log('Attempting to scrape Whop website for member data...');
    
    // Fetch the webpage directly
    const response = await fetch('https://whop.com/ai-innovation/');
    const html = await response.text();
    
    // Use a simple regex approach first
    const memberCountRegex = /(\d+)\s+members/i;
    const memberMatch = html.match(memberCountRegex);
    
    if (memberMatch) {
      console.log('Member count found via regex:', memberMatch[1]);
      return memberMatch[1];
    }
    
    // If regex fails, try more advanced parsing
    console.log('Basic regex didn\'t find member count, trying more advanced parsing...');
    
    // Search for any numbers followed by "members", "customers", "users", etc.
    const extendedRegex = /(\d+)(?:\s+|&nbsp;|<[^>]*>)(?:members|customers|users|subscribers)/i;
    const extendedMatch = html.match(extendedRegex);
    
    if (extendedMatch) {
      console.log('Member count found via extended regex:', extendedMatch[1]);
      return extendedMatch[1];
    }
    
    // Look for metadata that might contain member count
    if (html.includes('member') || html.includes('Member')) {
      const memberLines = html.split('\n').filter(line => 
        line.toLowerCase().includes('member') || 
        line.toLowerCase().includes('count') ||
        line.toLowerCase().includes('user'));
      
      if (memberLines.length > 0) {
        console.log('Lines that might contain member info:');
        memberLines.slice(0, 5).forEach(line => console.log('- ' + line.trim()));
      }
    }
    
    // Search for JSON data in the page that might contain stats
    const jsonDataMatch = html.match(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs);
    if (jsonDataMatch) {
      console.log('Found JSON data blocks in HTML:', jsonDataMatch.length);
      
      for (let i = 0; i < jsonDataMatch.length; i++) {
        try {
          const jsonString = jsonDataMatch[i].replace(/<script[^>]*type="application\/json"[^>]*>/, '').replace(/<\/script>/, '');
          const jsonData = JSON.parse(jsonString);
          
          // Log potentially useful data
          if (jsonData.props?.pageProps?.company) {
            console.log('Company data found in JSON:', jsonData.props.pageProps.company);
            
            // Check if member count exists in the company data
            if (jsonData.props.pageProps.company.membersCount) {
              console.log('Member count from JSON:', jsonData.props.pageProps.company.membersCount);
              return jsonData.props.pageProps.company.membersCount;
            }
          }
          
          // Check for other relevant data
          if (jsonData.props?.pageProps?.stats) {
            console.log('Stats found in JSON:', jsonData.props.pageProps.stats);
          }
        } catch (err) {
          console.log(`Error parsing JSON block ${i}:`, err.message);
        }
      }
    }
    
    console.log('Could not find member count in website HTML');
    return null;
  } catch (error) {
    console.error('Error scraping website:', error);
    return null;
  }
}

// Test direct API endpoints focusing on ai-innovation
async function testAiInnovationAPI() {
  console.log('=== TESTING AI INNOVATION BUSINESS DATA ===\n');

  // 1. Try to get company profile for ai-innovation using public API
  console.log('\n--- TEST 1: Public Company Profile ---');
  const publicCompanyResult = await makeWhopRequest('https://api.whop.com/api/v2/companies/ai-innovation', {}, {
    // No auth header for public endpoints
    'Authorization': null
  });
  
  if (publicCompanyResult.success) {
    console.log('Public Company Profile:', JSON.stringify(publicCompanyResult.data, null, 2));
  }

  // 2. Try getting products for the company
  console.log('\n--- TEST 2: Company Products ---');
  const productsResult = await makeWhopRequest('https://api.whop.com/api/v2/companies/ai-innovation/products');
  if (productsResult.success) {
    console.log('Products Count:', productsResult.data.pagination?.total_count ?? 0);
    console.log('First product:', productsResult.data.data?.length > 0 ? 
      JSON.stringify(productsResult.data.data[0], null, 2) : 'No products');
  }

  // 3. Try to get member count from website scraping
  console.log('\n--- TEST 3: Website Scraping ---');
  const memberCount = await scrapeWhopWebsite();
  if (memberCount) {
    console.log('Member Count from website:', memberCount);
  }
  
  console.log('\n=== TESTING COMPLETE ===');
}

// Execute the test
testAiInnovationAPI();
