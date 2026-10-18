/**
 * Whop API Client - Express.js API Version
 * 
 * A production-ready Express.js API for retrieving Whop member counts.
 * Includes caching, error handling, and multiple fallback methods.
 * 
 * @author Isaiah Dupree
 * @version 1.0.0
 */

// Import required packages
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');

// Load environment variables
dotenv.config();

// Cache configuration (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Environment configuration
const config = {
  // API credentials
  apiKey: process.env.WHOP_API_KEY || 'QJp8VBWDVhaVYLLiu8vNFSxX_0c9du7-riOYF7JjNSI',
  appId: process.env.WHOP_APP_ID || 'app_L3qVLiVTyjKR8D',
  agentUserId: process.env.WHOP_AGENT_USER_ID || 'user_v1zpj38VHwKaj',
  // API configuration
  baseUrl: 'https://api.whop.com',
  timeout: 10000, // 10 seconds
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info' // 'debug', 'info', 'warn', 'error'
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

  constructor(level = 'info') {
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
  constructor(message, status, responseData) {
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
  /**
   * Create a new Whop API client
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
  }

  /**
   * Make a request to the Whop API
   * @param {string} endpoint - API endpoint path (without base URL)
   * @param {Object} params - Query parameters
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} - Response data
   * @throws {WhopApiError} - If the request fails
   */
  async request(endpoint, params = {}, options = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams 
        ? `${this.config.baseUrl}${endpoint}?${queryParams}` 
        : `${this.config.baseUrl}${endpoint}`;
      
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
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
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
          
          throw new WhopApiError(
            `API request failed with status ${response.status}`,
            response.status,
            errorData
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new WhopApiError('Request timeout', 408);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof WhopApiError) {
        throw error;
      }
      this.logger.error('Request error:', error);
      throw new WhopApiError(error.message || 'Unknown error occurred');
    }
  }

  /**
   * Get business members
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} - Members data with pagination
   */
  async getBusinessMembers(options = {}) {
    return this.request('/api/v2/members', options);
  }

  /**
   * Get members filtered by app ID
   * @returns {Promise<Object>} - Members data with pagination
   */
  async getAppMembers() {
    return this.request('/api/v2/members', {
      app_id: this.config.appId,
      agent_user_id: this.config.agentUserId
    });
  }

  /**
   * Get app members via v5 endpoint
   * @returns {Promise<Object>} - App members data
   */
  async getV5AppMembers() {
    return this.request('/api/v5/app/members', {
      per: '1'
    });
  }

  /**
   * Get experiences
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} - Experiences data with pagination
   */
  async getExperiences(options = {}) {
    return this.request('/api/v2/experiences', options);
  }

  /**
   * Get company info
   * @returns {Promise<Object>} - Company information
   */
  async getCompanyInfo() {
    return this.request('/api/v2/me/company');
  }

  /**
   * Get member count with multiple fallback options
   * @returns {Promise<number>} - Total member count
   * @throws {WhopApiError} - If all endpoints fail
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
   * @param {string} businessSlug - Business slug (e.g., 'ai-innovation')
   * @returns {Promise<number|null>} - Member count or null if not found
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
      const memberCountRegex = /(\\d+)(?:\\s+|&nbsp;|<[^>]*>)(?:members|customers|users)/i;
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
  /**
   * Create a new Whop service
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.apiClient = new WhopApiClient(config);
    this.logger = new Logger(config.logLevel);
  }

  /**
   * Get member count using the most reliable method available
   * @param {Object} options - Options for member count retrieval
   * @param {boolean} options.useApi - Whether to try the API first
   * @param {boolean} options.useScraping - Whether to try web scraping
   * @param {string} options.businessSlug - Business slug for scraping
   * @returns {Promise<Object>} - Member count data from different sources
   */
  async getMemberCount(options = { 
    useApi: true, 
    useScraping: true, 
    businessSlug: 'ai-innovation',
    useCache: true 
  }) {
    const cacheKey = `whop_members_${options.businessSlug}`;
    
    // Check cache first if enabled
    if (options.useCache) {
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        this.logger.info(`Using cached member count: ${cachedResult.final}`);
        return cachedResult;
      }
    }
    
    const result = {
      api: null,
      scraping: null,
      final: null,
      source: null,
      timestamp: new Date().toISOString()
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
    if (options.useScraping && (result.api === null || options.preferScraping)) {
      try {
        this.logger.info('Attempting to get member count via web scraping...');
        const scrapedCount = await WhopScraper.getMemberCount(options.businessSlug);
        result.scraping = scrapedCount;
        
        // Use scraping result if API failed or if scraping is preferred
        if (result.final === null || options.preferScraping) {
          result.final = scrapedCount;
          result.source = 'scraping';
        }
        
        this.logger.info(`Scraped member count: ${scrapedCount}`);
      } catch (error) {
        this.logger.error('Failed to get member count via scraping', error);
      }
    }

    // Save to cache if we have a result
    if (result.final !== null && options.useCache) {
      cache.set(cacheKey, result);
      this.logger.debug(`Saved member count to cache: ${result.final}`);
    }

    return result;
  }
}

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create Whop service
const whopService = new WhopService(config);

// Routes
app.get('/api/whop/members', async (req, res) => {
  try {
    const businessSlug = req.query.business || 'ai-innovation';
    const forceRefresh = req.query.refresh === 'true';
    
    const memberCount = await whopService.getMemberCount({
      businessSlug,
      useCache: !forceRefresh
    });
    
    res.json({
      members: memberCount.final || 0,
      source: memberCount.source,
      timestamp: memberCount.timestamp
    });
  } catch (error) {
    console.error('Error getting member count:', error);
    res.status(500).json({
      error: error.message || 'Unknown error occurred',
      members: 0
    });
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Whop API server listening on port ${port}`);
  });
}

// Export for testing/importing
module.exports = {
  app,
  WhopApiClient,
  WhopScraper,
  WhopService,
  WhopApiError,
  Logger
};
