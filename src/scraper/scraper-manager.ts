import { ScraperOptions, ScraperResponse, BrowserAction } from '../types';
import { PlaywrightScraper } from './playwright-scraper';
import { ContentCleaner } from '../transformers/content-cleaner';
import { HtmlToMarkdownTransformer } from '../transformers/html-to-markdown';
import { LLMExtractor } from '../transformers/llm-extractor';
import { LLMServiceFactory } from '../services/llm-service-factory';
import { CacheService } from '../services/cache.service';
import { ExtractionOptions } from '../types/schema';
import { logger } from '../utils/logger';

export class ScraperManager {
  private playwriteScraper: PlaywrightScraper;
  private contentCleaner: ContentCleaner;
  private markdownTransformer: HtmlToMarkdownTransformer;
  private llmExtractor: LLMExtractor | null = null;
  private cacheService: CacheService;

  constructor() {
    this.playwriteScraper = new PlaywrightScraper();
    this.contentCleaner = new ContentCleaner();
    this.markdownTransformer = new HtmlToMarkdownTransformer();
    
    // Initialize cache service
    this.cacheService = new CacheService({
      enabled: process.env.CACHE_ENABLED === 'true',
      ttl: Number(process.env.CACHE_TTL || 3600),
      directory: process.env.CACHE_DIRECTORY || './cache'
    });
    
    // Initialize LLM extractor with GPT-4o model
    this.initializeLLMExtractor();
  }

  /**
   * Generate a unique cache key for a scrape request
   */
  private generateCacheKey(url: string, options: ScraperOptions): string {
    // Create a simplified version of options for the cache key
    const cacheableOptions = {
      extractorFormat: options.extractorFormat,
      waitForSelector: options.waitForSelector,
      actions: options.actions
    };
    
    return `${url}:${JSON.stringify(cacheableOptions)}`;
  }

  /**
   * Initialize LLM extractor with GPT-4o model
   */
  private async initializeLLMExtractor(): Promise<void> {
    try {
      // Get the appropriate LLM service
      const llmService = LLMServiceFactory.createLLMService();
      
      if (!llmService) {
        logger.warn('Failed to initialize LLM service for extraction');
        return;
      }
      
      this.llmExtractor = new LLMExtractor(llmService);
      logger.info('LLM extractor initialized successfully');
    } catch (error) {
      logger.error(`Error initializing LLM extractor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Scrape a URL and apply transformations based on options
   */
  async scrape<T = any>(url: string, options: ScraperOptions & { 
    extractionOptions?: ExtractionOptions;
    skipCache?: boolean;
    cacheTtl?: number; // Custom TTL in seconds
  } = {}): Promise<ScraperResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(url, options);
    
    try {
      logger.info(`Starting scraping process for URL: ${url}`);
      
      // Check cache first unless skipCache is true
      if (!options.skipCache) {
        const cachedResponse = await this.cacheService.get<ScraperResponse>(cacheKey);
        if (cachedResponse) {
          logger.info(`Retrieved from cache: ${url}`);
          return cachedResponse;
        }
      }
      
      // Step 1: Get raw HTML using Playwright scraper
      const scraperResponse = await this.playwriteScraper.scrape(url, options);
      
      // If there was an error, return immediately
      if (scraperResponse.error) {
        logger.error(`Error occurred during scraping: ${scraperResponse.error}`);
        return scraperResponse;
      }

      // Step 2: Clean HTML content
      const cleanedResponse = this.contentCleaner.clean(scraperResponse);
      
      // If cleaning resulted in an error, return immediately
      if (cleanedResponse.error && !scraperResponse.error) {
        logger.error(`Error occurred during content cleaning: ${cleanedResponse.error}`);
        return cleanedResponse;
      }

      // Step 3: Apply transformations based on options
      let processedResponse = cleanedResponse;
      
      // Debug logging for content type and extraction format
      logger.info(`Processing response. Content type: ${cleanedResponse.contentType}, Extractor format: ${options.extractorFormat}`);

      // Convert to markdown if requested
      if (options.extractorFormat === 'markdown') {
        logger.info('Converting HTML to Markdown');
        if (cleanedResponse.contentType !== 'html') {
          logger.warn(`Content type is not HTML (${cleanedResponse.contentType}), forcing conversion to HTML`);
          cleanedResponse.contentType = 'html';
        }
        
        // Ensure content is not empty
        if (!cleanedResponse.content || cleanedResponse.content.trim() === '') {
          logger.warn('Content is empty, cannot convert to Markdown');
        } else {
          processedResponse = this.markdownTransformer.transform(cleanedResponse);
          logger.info(`Markdown conversion complete. Content length: ${processedResponse.content.length}`);
        }
      }
      // Convert to text if requested (simple text extraction)
      else if (options.extractorFormat === 'text') {
        processedResponse = this.extractTextOnly(cleanedResponse);
      }

      // Step 4: Apply LLM extraction if requested
      if (options.extractionOptions && this.llmExtractor) {
        logger.info('Applying LLM extraction with schema');
        
        const extractionResult = await this.llmExtractor.extract<T>(
          processedResponse, 
          options.extractionOptions
        );
        
        processedResponse = extractionResult;
      } else if (options.extractionOptions) {
        logger.warn('Extraction options provided but LLM extractor not available');
      }
      
      // Add performance metrics
      processedResponse.metadata.processingTime = Date.now() - startTime;
      
      // Store in cache if no errors occurred
      if (!processedResponse.error && !options.skipCache) {
        await this.cacheService.set(cacheKey, processedResponse, {
          url,
          contentType: processedResponse.contentType,
          customTtl: options.cacheTtl
        });
      }
      
      logger.info(`Scraping process completed successfully for URL: ${url} in ${Date.now() - startTime}ms`);
      return processedResponse;
    } catch (error) {
      logger.error(`Unexpected error during scraping process: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        url,
        title: '',
        content: '',
        contentType: 'html',
        metadata: {
          timestamp: new Date().toISOString(),
          status: 0,
          headers: {},
          processingTime: Date.now() - startTime
        },
        error: `Scraping process error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Close browser instances
   */
  async close(): Promise<void> {
    // This method is needed to properly close any Playwright instances
    logger.info('Closing Scraper Manager resources');
  }

  /**
   * Extract text only from HTML content
   */
  private extractTextOnly(scraperResponse: ScraperResponse): ScraperResponse {
    try {
      if (scraperResponse.contentType !== 'html' || !scraperResponse.content) {
        return scraperResponse;
      }

      // Use a simple regex to strip all HTML tags
      const textContent = scraperResponse.content
        .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
        .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
        .trim();                 // Trim extra spaces

      return {
        ...scraperResponse,
        content: textContent,
        contentType: 'text'
      };
    } catch (error) {
      logger.error(`Error extracting text: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        ...scraperResponse,
        error: `Text extraction error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clear();
  }
  
  /**
   * Invalidate a specific URL in the cache
   */
  async invalidateCache(url: string): Promise<void> {
    await this.cacheService.invalidate(url);
  }
}

// Create singleton instance
const scraperManager = new ScraperManager();
export default scraperManager; 