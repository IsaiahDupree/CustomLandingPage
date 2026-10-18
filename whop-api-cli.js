#!/usr/bin/env node

/**
 * Whop API Client - CLI Version
 * 
 * A command-line utility for retrieving Whop member counts.
 * Can be run directly from the terminal.
 * 
 * @author Isaiah Dupree
 * @version 1.0.0
 */

// Required for parsing command line arguments
const minimist = require('minimist');

// Environment configuration (with command-line overrides)
const args = minimist(process.argv.slice(2), {
  string: ['api-key', 'app-id', 'agent-user-id', 'business'],
  boolean: ['scraping', 'api', 'verbose', 'help'],
  alias: {
    k: 'api-key',
    a: 'app-id',
    u: 'agent-user-id',
    b: 'business',
    s: 'scraping',
    i: 'api',
    v: 'verbose',
    h: 'help'
  },
  default: {
    scraping: true,
    api: true,
    verbose: false,
    business: 'ai-innovation'
  }
});

// Show help if requested
if (args.help) {
  console.log(`
Whop API Client - CLI

Usage:
  node whop-api-cli.js [options]

Options:
  -k, --api-key KEY        Whop API key
  -a, --app-id ID          Whop App ID (default: app_L3qVLiVTyjKR8D)
  -u, --agent-user-id ID   Whop Agent User ID (default: user_v1zpj38VHwKaj)
  -b, --business SLUG      Business slug to scrape (default: ai-innovation)
  -s, --scraping           Enable web scraping (default: true)
  -i, --api                Enable API access (default: true)
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message

Examples:
  node whop-api-cli.js
  node whop-api-cli.js --api-key=YOUR_API_KEY --business=your-business
  node whop-api-cli.js --scraping=false --api=true
  `);
  process.exit(0);
}

// Configure from arguments or environment variables
const config = {
  // API credentials
  apiKey: args['api-key'] || process.env.WHOP_API_KEY || process.env.WHOP_API_KEY,
  appId: args['app-id'] || process.env.WHOP_APP_ID || 'app_L3qVLiVTyjKR8D',
  agentUserId: args['agent-user-id'] || process.env.WHOP_AGENT_USER_ID || 'user_v1zpj38VHwKaj',
  // API configuration
  baseUrl: 'https://api.whop.com',
  timeout: 10000, // 10 seconds
  // Logging configuration
  logLevel: args.verbose ? 'debug' : (process.env.LOG_LEVEL || 'info')
};

/**
 * Logger utility for consistent logging with colorized output
 */
class Logger {
  static LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  // ANSI color codes
  static COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    fg: {
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',
    },
    
    bg: {
      black: '\x1b[40m',
      red: '\x1b[41m',
      green: '\x1b[42m',
      yellow: '\x1b[43m',
      blue: '\x1b[44m',
      magenta: '\x1b[45m',
      cyan: '\x1b[46m',
      white: '\x1b[47m',
      gray: '\x1b[100m',
    }
  };

  constructor(level = 'info') {
    this.level = Logger.LEVELS[level] || Logger.LEVELS.info;
  }

  debug(message, ...args) {
    if (this.level <= Logger.LEVELS.debug) {
      console.debug(
        `${Logger.COLORS.fg.gray}[DEBUG]${Logger.COLORS.reset} ${message}`, 
        ...args
      );
    }
  }

  info(message, ...args) {
    if (this.level <= Logger.LEVELS.info) {
      console.info(
        `${Logger.COLORS.fg.green}[INFO]${Logger.COLORS.reset} ${message}`, 
        ...args
      );
    }
  }

  warn(message, ...args) {
    if (this.level <= Logger.LEVELS.warn) {
      console.warn(
        `${Logger.COLORS.fg.yellow}[WARN]${Logger.COLORS.reset} ${message}`, 
        ...args
      );
    }
  }

  error(message, ...args) {
    if (this.level <= Logger.LEVELS.error) {
      console.error(
        `${Logger.COLORS.fg.red}[ERROR]${Logger.COLORS.reset} ${message}`, 
        ...args
      );
    }
  }

  success(message, ...args) {
    if (this.level <= Logger.LEVELS.info) {
      console.info(
        `${Logger.COLORS.fg.green}${Logger.COLORS.bright}[SUCCESS]${Logger.COLORS.reset} ${message}`, 
        ...args
      );
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
        this.logger.success(`Found ${count} members via v5 app/members endpoint`);
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
        this.logger.success(`Found ${count} members via v2 members endpoint`);
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
        this.logger.success(`Found ${count} members via app-specific endpoint`);
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
        this.logger.success(`Found ${count} members via company info`);
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
        this.logger.success(`Found ${count} experiences (potential member indicator)`);
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
        logger.success(`Found ${count} members for ${businessSlug} via scraping`);
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
              logger.success(`Found ${count} members in JSON data for ${businessSlug}`);
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
    businessSlug: 'ai-innovation'
  }) {
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

    return result;
  }
}

/**
 * Main function to run the CLI
 */
async function main() {
  const logger = new Logger(config.logLevel);
  
  logger.info('Whop API Client - CLI');
  logger.info(`Business: ${args.business}`);
  logger.info(`API enabled: ${args.api}`);
  logger.info(`Scraping enabled: ${args.scraping}`);
  
  try {
    const whopService = new WhopService(config);
    const result = await whopService.getMemberCount({
      useApi: args.api,
      useScraping: args.scraping,
      businessSlug: args.business
    });
    
    if (result.final !== null) {
      logger.success('============================================');
      logger.success(`📊 Member count: ${result.final}`);
      logger.success(`🔍 Data source: ${result.source}`);
      logger.success(`⏱️ Timestamp: ${result.timestamp}`);
      logger.success('============================================');
      
      // Display more details in verbose mode
      if (args.verbose) {
        logger.info('Detailed results:');
        logger.info(`API count: ${result.api !== null ? result.api : 'N/A'}`);
        logger.info(`Scraped count: ${result.scraping !== null ? result.scraping : 'N/A'}`);
      }
      
      process.exit(0);
    } else {
      logger.error('Failed to get member count from any source');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error:', error.message);
    if (args.verbose && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

// Export classes for testing/importing
module.exports = {
  WhopApiClient,
  WhopScraper,
  WhopService,
  WhopApiError,
  Logger
};
