// Test script to fetch Whop member data using the GraphQL API
// This might provide more access than the REST API for App keys

// API credentials
const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_APP_ID = 'app_L3qVLiVTyjKR8D';
const WHOP_AGENT_USER_ID = 'user_v1zpj38VHwKaj';

// GraphQL query for storepage views
const storePageViewsQuery = `
  query StorepageViewsTotal {
    statsStorepageViews {
      sum    # total lifetime page views for your store
      max
      min
      data { timestamp value }
    }
  }
`;

// Check if a business/company exists
const businessQuery = `
  query GetBusiness {
    business {
      id
      name
      social {
        discord
        instagram
        twitter
      }
      membersCount
    }
  }
`;

// Get app info query
const appInfoQuery = `
  query GetAppInfo {
    app {
      id
      name
      description
      membersCount
    }
  }
`;

// Function to make GraphQL requests
async function queryWhopGraphQL(query, variables = {}) {
  try {
    console.log('Executing GraphQL query:', query.split('{')[0].trim());
    
    const response = await fetch('https://api.whop.com/public-graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'X-App-Id': WHOP_APP_ID,
        'X-On-Behalf-Of': WHOP_AGENT_USER_ID
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error ${response.status}: ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL Errors:', result.errors);
      return { success: false, errors: result.errors };
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Request error:', error);
    return { success: false, error: error.message };
  }
}

// Test different GraphQL queries
async function testWhopGraphQL() {
  console.log('=== TESTING WHOP GRAPHQL API ===\n');

  // 1. Test storepage views query
  console.log('\n--- TEST 1: Storepage Views ---');
  const viewsResult = await queryWhopGraphQL(storePageViewsQuery);
  if (viewsResult.success) {
    console.log('Storepage Views Sum:', viewsResult.data.statsStorepageViews?.sum);
    console.log('Storepage Views Data:', viewsResult.data.statsStorepageViews?.data?.length, 'items');
  }

  // 2. Test business query
  console.log('\n--- TEST 2: Business Info ---');
  const businessResult = await queryWhopGraphQL(businessQuery);
  if (businessResult.success) {
    console.log('Business Info:', businessResult.data.business);
    console.log('Members Count:', businessResult.data.business?.membersCount);
  }

  // 3. Test app info query
  console.log('\n--- TEST 3: App Info ---');
  const appResult = await queryWhopGraphQL(appInfoQuery);
  if (appResult.success) {
    console.log('App Info:', appResult.data.app);
    console.log('App Members Count:', appResult.data.app?.membersCount);
  }
  
  // 4. Try a different approach - with explicit headers
  console.log('\n--- TEST 4: With Company/Business ID ---');
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHOP_API_KEY}`,
      'X-On-Behalf-Of': WHOP_AGENT_USER_ID,
      'X-Company-Id': 'biz_ai-innovation' // This is a guess based on the URL
    };
    
    console.log('Using headers:', headers);
    
    const response = await fetch('https://api.whop.com/public-graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: businessQuery
      })
    });
    
    const result = await response.json();
    console.log('Response with company ID:', result);
  } catch (error) {
    console.error('Error with company ID:', error);
  }
  
  console.log('\n=== TESTING COMPLETE ===');
}

// Execute the GraphQL tests
testWhopGraphQL();
