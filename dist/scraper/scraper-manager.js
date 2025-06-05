"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperManager = void 0;
const playwright_scraper_1 = require("./playwright-scraper");
const content_cleaner_1 = require("../transformers/content-cleaner");
const html_to_markdown_1 = require("../transformers/html-to-markdown");
const llm_extractor_1 = require("../transformers/llm-extractor");
const llm_service_factory_1 = require("../services/llm-service-factory");
const cache_service_1 = require("../services/cache.service");
const logger_1 = require("../utils/logger");
class ScraperManager {
    constructor() {
        this.llmExtractor = null;
        this.playwriteScraper = new playwright_scraper_1.PlaywrightScraper();
        this.contentCleaner = new content_cleaner_1.ContentCleaner();
        this.markdownTransformer = new html_to_markdown_1.HtmlToMarkdownTransformer();
        // Initialize cache service
        this.cacheService = new cache_service_1.CacheService({
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
    generateCacheKey(url, options) {
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
    async initializeLLMExtractor() {
        try {
            // Get Azure OpenAI service with GPT-4o
            const azureOpenAIService = llm_service_factory_1.LLMServiceFactory.createAzureOpenAIService();
            if (!azureOpenAIService) {
                logger_1.logger.warn('Failed to initialize Azure OpenAI service for LLM extraction');
                return;
            }
            this.llmExtractor = new llm_extractor_1.LLMExtractor(azureOpenAIService);
            logger_1.logger.info('LLM extractor initialized with GPT-4o model');
        }
        catch (error) {
            logger_1.logger.error(`Error initializing LLM extractor: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Scrape a URL and apply transformations based on options
     */
    async scrape(url, options = {}) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(url, options);
        try {
            logger_1.logger.info(`Starting scraping process for URL: ${url}`);
            // Check cache first unless skipCache is true
            if (!options.skipCache) {
                const cachedResponse = await this.cacheService.get(cacheKey);
                if (cachedResponse) {
                    logger_1.logger.info(`Retrieved from cache: ${url}`);
                    return cachedResponse;
                }
            }
            // Step 1: Get raw HTML using Playwright scraper
            const scraperResponse = await this.playwriteScraper.scrape(url, options);
            // If there was an error, return immediately
            if (scraperResponse.error) {
                logger_1.logger.error(`Error occurred during scraping: ${scraperResponse.error}`);
                return scraperResponse;
            }
            // Step 2: Clean HTML content
            const cleanedResponse = this.contentCleaner.clean(scraperResponse);
            // If cleaning resulted in an error, return immediately
            if (cleanedResponse.error && !scraperResponse.error) {
                logger_1.logger.error(`Error occurred during content cleaning: ${cleanedResponse.error}`);
                return cleanedResponse;
            }
            // Step 3: Apply transformations based on options
            let processedResponse = cleanedResponse;
            // Debug logging for content type and extraction format
            logger_1.logger.info(`Processing response. Content type: ${cleanedResponse.contentType}, Extractor format: ${options.extractorFormat}`);
            // Convert to markdown if requested
            if (options.extractorFormat === 'markdown') {
                logger_1.logger.info('Converting HTML to Markdown');
                if (cleanedResponse.contentType !== 'html') {
                    logger_1.logger.warn(`Content type is not HTML (${cleanedResponse.contentType}), forcing conversion to HTML`);
                    cleanedResponse.contentType = 'html';
                }
                // Ensure content is not empty
                if (!cleanedResponse.content || cleanedResponse.content.trim() === '') {
                    logger_1.logger.warn('Content is empty, cannot convert to Markdown');
                }
                else {
                    processedResponse = this.markdownTransformer.transform(cleanedResponse);
                    logger_1.logger.info(`Markdown conversion complete. Content length: ${processedResponse.content.length}`);
                }
            }
            // Convert to text if requested (simple text extraction)
            else if (options.extractorFormat === 'text') {
                processedResponse = this.extractTextOnly(cleanedResponse);
            }
            // Step 4: Apply LLM extraction if requested
            if (options.extractionOptions && this.llmExtractor) {
                logger_1.logger.info('Applying LLM extraction with schema');
                const extractionResult = await this.llmExtractor.extract(processedResponse, options.extractionOptions);
                processedResponse = extractionResult;
            }
            else if (options.extractionOptions) {
                logger_1.logger.warn('Extraction options provided but LLM extractor not available');
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
            logger_1.logger.info(`Scraping process completed successfully for URL: ${url} in ${Date.now() - startTime}ms`);
            return processedResponse;
        }
        catch (error) {
            logger_1.logger.error(`Unexpected error during scraping process: ${error instanceof Error ? error.message : String(error)}`);
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
    async close() {
        // This method is needed to properly close any Playwright instances
        logger_1.logger.info('Closing Scraper Manager resources');
    }
    /**
     * Extract text only from HTML content
     */
    extractTextOnly(scraperResponse) {
        try {
            if (scraperResponse.contentType !== 'html' || !scraperResponse.content) {
                return scraperResponse;
            }
            // Use a simple regex to strip all HTML tags
            const textContent = scraperResponse.content
                .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .trim(); // Trim extra spaces
            return {
                ...scraperResponse,
                content: textContent,
                contentType: 'text'
            };
        }
        catch (error) {
            logger_1.logger.error(`Error extracting text: ${error instanceof Error ? error.message : String(error)}`);
            return {
                ...scraperResponse,
                error: `Text extraction error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Clear the cache
     */
    async clearCache() {
        await this.cacheService.clear();
    }
    /**
     * Invalidate a specific URL in the cache
     */
    async invalidateCache(url) {
        await this.cacheService.invalidate(url);
    }
}
exports.ScraperManager = ScraperManager;
// Create singleton instance
const scraperManager = new ScraperManager();
exports.default = scraperManager;
