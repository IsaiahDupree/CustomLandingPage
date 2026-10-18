// Simple script to get Whop member count via web scraping
// This avoids API permission issues by directly reading the member count from the website

/**
 * Gets the member count from a Whop business page by scraping the HTML
 * @param {string} businessSlug - The business slug (e.g., 'ai-innovation')
 * @returns {Promise<number|null>} - The member count or null if not found
 */
async function getWhopMemberCount(businessSlug) {
  try {
    console.log(`Fetching member count for ${businessSlug}...`);
    
    // Fetch the business page
    const response = await fetch(`https://whop.com/${businessSlug}/`);
    if (!response.ok) {
      console.error(`Error fetching page: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Search for number followed by "members" using regex
    const memberCountRegex = /(\d+)(?:\s+|&nbsp;|<[^>]*>)(?:members|customers|users)/i;
    const memberMatch = html.match(memberCountRegex);
    
    if (memberMatch) {
      const count = parseInt(memberMatch[1], 10);
      console.log(`Found ${count} members for ${businessSlug}`);
      return count;
    }
    
    // Try searching for JSON data that might contain the count
    const jsonDataMatch = html.match(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs);
    if (jsonDataMatch) {
      for (const jsonBlock of jsonDataMatch) {
        try {
          const jsonString = jsonBlock.replace(/<script[^>]*type="application\/json"[^>]*>/, '').replace(/<\/script>/, '');
          const jsonData = JSON.parse(jsonString);
          
          if (jsonData.props?.pageProps?.company?.membersCount) {
            const count = jsonData.props.pageProps.company.membersCount;
            console.log(`Found ${count} members in JSON data for ${businessSlug}`);
            return count;
          }
        } catch (err) {
          // Skip JSON parsing errors
        }
      }
    }
    
    console.log(`Could not find member count for ${businessSlug}`);
    return null;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Example usage
async function main() {
  // The business slug from the URL: https://whop.com/ai-innovation/
  const businessSlug = 'ai-innovation';
  
  const memberCount = await getWhopMemberCount(businessSlug);
  
  if (memberCount !== null) {
    console.log(`✅ ${businessSlug} has ${memberCount} members`);
  } else {
    console.log(`❌ Could not determine member count for ${businessSlug}`);
  }
}

// Run the script
main();
