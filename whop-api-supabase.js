import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Whop API Client
 * 
 * A production-ready client for interacting with the Whop API
 * to retrieve member counts and other business data.
 * 
 * @author Isaiah Dupree
 * @version 1.0.0
 */

// Environment configuration
const config = {
  // API credentials
  apiKey: Deno.env.get('WHOP_API_KEY') || '',
  appId: Deno.env.get('WHOP_APP_ID') || 'app_L3qVLiVTyjKR8D',
  agentUserId: Deno.env.get('WHOP_AGENT_USER_ID') || 'user_v1zpj38VHwKaj',
  // API configuration
  baseUrl: 'https://api.whop.com',
  timeout: 10000,
  // Logging configuration
  logLevel: Deno.env.get('LOG_LEVEL') || 'info' // 'debug', 'info', 'warn', 'error'
};

/**
 * Logger utility for consistent logging
 */
class Logger {
  static LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  level;
  constructor(level = 'info'){
    this.level = Logger.LEVELS[level] || Logger.LEVELS.info;
  }
  debug(message, ...args) {
    if (this.level <= Logger.LEVELS.debug) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
  info(message, ...args) {
    if (this.level <= Logger.LEVELS.info) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }
  warn(message, ...args) {
    if (this.level <= Logger.LEVELS.warn) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }
  error(message, ...args) {
    if (this.level <= Logger.LEVELS.error) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

/**
 * Custom error class for Whop API errors
 */
class WhopApiError extends Error {
  status;
  responseData;
  constructor(message, status, responseData){
    super(message);
    this.name = 'WhopApiError';
    this.status = status;
    this.responseData = responseData;
  }
}

/**
 * Whop API client for interacting with various Whop endpoints
 */
class WhopApiClient {
  config;
  logger;
  constructor(config){
    this.config = config;
    this.logger = new Logger(config.logLevel);
  }

  /**
   * Make a request to the Whop API
   */
  async request(endpoint, params = {}, options = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${this.config.baseUrl}${endpoint}?${queryParams}` : `${this.config.baseUrl}${endpoint}`;
      
      this.logger.debug(`Making request to: ${url}`);
      
      const requestOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };

      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(()=>controller.abort(), this.config.timeout);
      requestOptions.signal = controller.signal;

      try {
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`API error (${response.status}): ${errorText}`);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = errorText;
          }
          
          throw new WhopApiError(`API request failed with status ${response.status}`, response.status, errorData);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new WhopApiError('Request timeout', 408);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof WhopApiError) {
        throw error;
      }
      this.logger.error('Request error:', error);
      throw new WhopApiError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * Get business members
   */
  async getBusinessMembers(options = {}) {
    return this.request('/api/v2/members', options);
  }

  /**
   * Get members filtered by app ID
   */
  async getAppMembers() {
    return this.request('/api/v2/members', {
      app_id: this.config.appId,
      agent_user_id: this.config.agentUserId
    });
  }

  /**
   * Get app members via v5 endpoint
   */
  async getV5AppMembers() {
    return this.request('/api/v5/app/members', {
      per: '1'
    });
  }

  /**
   * Get experiences
   */
  async getExperiences(options = {}) {
    return this.request('/api/v2/experiences', options);
  }

  /**
   * Get company info
   */
  async getCompanyInfo() {
    return this.request('/api/v2/me/company');
  }

  /**
   * Get member count (with fallback options)
   */
  async getMemberCount() {
    // Try v5 app members endpoint first
    try {
      this.logger.info('Trying v5 app/members endpoint...');
      const result = await this.getV5AppMembers();
      if (result?.pagination?.total_count !== undefined) {
        const count = result.pagination.total_count;
        this.logger.info(`✅ Found ${count} members via v5 app/members endpoint`);
        return count;
      }
    } catch (error) {
      this.logger.warn('v5 app/members endpoint failed:', error);
    }

    // Try v2 business members endpoint
    try {
      this.logger.info('Trying v2 members endpoint...');
      const result = await this.getBusinessMembers({
        per: '1'
      });
      if (result?.pagination?.total_count !== undefined) {
        const count = result.pagination.total_count;
        this.logger.info(`✅ Found ${count} members via v2 members endpoint`);
        return count;
      }
    } catch (error) {
      this.logger.warn('v2 members endpoint failed:', error);
    }

    // Try app-specific members
    try {
      this.logger.info('Trying app-specific members...');
      const result = await this.getAppMembers();
      if (result?.pagination?.total_count !== undefined) {
        const count = result.pagination.total_count;
        this.logger.info(`✅ Found ${count} members via app-specific endpoint`);
        return count;
      }
    } catch (error) {
      this.logger.warn('App-specific members endpoint failed:', error);
    }

    // Try company info
    try {
      this.logger.info('Trying company info...');
      const result = await this.getCompanyInfo();
      if (result?.members_count !== undefined) {
        const count = result.members_count;
        this.logger.info(`✅ Found ${count} members via company info`);
        return count;
      }
    } catch (error) {
      this.logger.warn('Company info endpoint failed:', error);
    }

    // Try experiences as a last resort
    try {
      this.logger.info('Trying experiences...');
      const result = await this.getExperiences();
      if (result?.pagination?.total_count !== undefined) {
        const count = result.pagination.total_count;
        this.logger.info(`✅ Found ${count} experiences (potential member indicator)`);
        return count;
      }
    } catch (error) {
      this.logger.warn('Experiences endpoint failed:', error);
    }

    throw new WhopApiError('No working API endpoint found for member count');
  }
}

/**
 * Whop scraper for when API access is limited
 */
class WhopScraper {
  /**
   * Get member count from Whop website
   */
  static async getMemberCount(businessSlug) {
    try {
      const logger = new Logger(config.logLevel);
      logger.info(`Fetching member count for ${businessSlug} via web scraping...`);
      
      const response = await fetch(`https://whop.com/${businessSlug}/`);
      if (!response.ok) {
        logger.error(`Error fetching page: ${response.status}`);
        return null;
      }
      
      const html = await response.text();
      
      // Search for number followed by "members" using regex
      const memberCountRegex = /(\d+)(?:\s+|&nbsp;|<[^>]*>)(?:members|customers|users)/i;
      const memberMatch = html.match(memberCountRegex);
      
      if (memberMatch) {
        const count = parseInt(memberMatch[1], 10);
        logger.info(`Found ${count} members for ${businessSlug} via scraping`);
        return count;
      }
      
      // Try searching for JSON data that might contain the count
      const jsonDataMatch = html.match(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs);
      if (jsonDataMatch) {
        logger.info(`Found ${jsonDataMatch.length} JSON blocks to search`);
        for (const jsonBlock of jsonDataMatch){
          try {
            const jsonString = jsonBlock.replace(/<script[^>]*type="application\/json"[^>]*>/, '').replace(/<\/script>/, '');
            const jsonData = JSON.parse(jsonString);
            
            if (jsonData.props?.pageProps?.company?.membersCount) {
              const count = jsonData.props.pageProps.company.membersCount;
              logger.info(`Found ${count} members in JSON data for ${businessSlug}`);
              return count;
            }
          } catch (err) {
            // Skip JSON parsing errors
            logger.debug('Skipping JSON block due to parsing error');
          }
        }
      }
      
      logger.warn(`Could not find member count for ${businessSlug} via scraping`);
      return null;
    } catch (error) {
      const logger = new Logger(config.logLevel);
      logger.error('Scraping error:', error);
      return null;
    }
  }
}

/**
 * Whop Service - Main class for interacting with Whop
 */
class WhopService {
  config;
  apiClient;
  logger;
  constructor(config){
    this.config = config;
    this.apiClient = new WhopApiClient(config);
    this.logger = new Logger(config.logLevel);
  }

  /**
   * Get member count using the most reliable method available
   */
  async getMemberCount(options = {
    useApi: true,
    useScraping: true,
    businessSlug: 'ai-innovation'
  }) {
    const result = {
      api: null,
      scraping: null,
      final: null,
      source: null
    };

    // Try API first if enabled
    if (options.useApi && this.config.apiKey) {
      try {
        this.logger.info('Attempting to get member count via API...');
        const apiCount = await this.apiClient.getMemberCount();
        result.api = apiCount;
        result.final = apiCount;
        result.source = 'api';
        this.logger.info(`API member count: ${apiCount}`);
      } catch (error) {
        this.logger.warn('Failed to get member count via API, will try scraping if enabled');
      }
    }

    // Try scraping if enabled or if API failed
    if (options.useScraping && result.api === null) {
      try {
        this.logger.info('Attempting to get member count via web scraping...');
        const scrapedCount = await WhopScraper.getMemberCount(options.businessSlug);
        result.scraping = scrapedCount;
        
        if (result.final === null) {
          result.final = scrapedCount;
          result.source = 'scraping';
        }
        
        this.logger.info(`Scraped member count: ${scrapedCount}`);
      } catch (error) {
        this.logger.error('Failed to get member count via scraping', error);
      }
    }

    return result;
  }
}

serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const today = new Date().toISOString().slice(0, 10);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log('Checking cache for Whop members on date:', today, forceRefresh ? '(forcing refresh)' : '');
    
    // 1. Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('daily_stats_cache')
        .select('*')
        .eq('stat_date', today)
        .single();
      
      if (cached && !cacheError && cached.members !== null) {
        console.log('Returning cached Whop member count:', cached.members);
        return new Response(JSON.stringify({
          members: cached.members
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    
    console.log('Fetching fresh member count...');
    
    // 2. Use the new WhopService to get member count
    const whopService = new WhopService(config);
    const memberCountResult = await whopService.getMemberCount();
    const members = memberCountResult.final || 0;
    
    console.log(`Final member count: ${members} (source: ${memberCountResult.source})`);
    
    // 3. Update cache with member count
    const { error: upsertError } = await supabase
      .from('daily_stats_cache')
      .upsert({
        stat_date: today,
        members,
        refreshed_at: new Date().toISOString()
      });
    
    if (upsertError) {
      console.error('Cache upsert error:', upsertError);
    } else {
      console.log('AI Innovation community members cache updated successfully with count:', members);
    }
    
    return new Response(JSON.stringify({
      members
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error('Error in get-whop-members:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      members: 0
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
