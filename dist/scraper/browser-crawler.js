"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserCrawler = void 0;
const url_1 = require("url");
const uuid_1 = require("uuid");
const browser_service_1 = require("../services/browser-service");
const logger_1 = require("../utils/logger");
const redisService = __importStar(require("../services/redis.service"));
// Define sleep function inline to avoid import issues
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
class BrowserCrawler {
    constructor(options) {
        this.visitedUrls = new Set();
        this.urlQueue = [];
        this.results = new Map();
        this.isRunning = false;
        this.isStopped = false;
        this.options = {
            maxCrawledLinks: 100,
            limit: 1000,
            maxCrawledDepth: 3,
            allowBackwardCrawling: false,
            allowExternalContentLinks: false,
            allowSubdomains: true,
            ignoreRobotsTxt: false,
            regexOnFullURL: true,
            delay: 1000,
            ...options
        };
        this.jobId = options.jobId || (0, uuid_1.v4)();
        this.browser = browser_service_1.BrowserService.getInstance();
        this.baseUrl = new url_1.URL(options.initialUrl);
        // Initialize URL queue with the starting URL
        this.urlQueue.push(options.initialUrl);
        // Compile regex patterns
        this.includePatterns = this.options.includes.map(pattern => new RegExp(pattern));
        this.excludePatterns = this.options.excludes.map(pattern => new RegExp(pattern));
        // Initialize stats
        this.stats = {
            totalLinks: 0,
            visitedLinks: 0,
            queuedLinks: 1, // Start with 1 for the initial URL
            extractedContent: 0,
            startTime: new Date(),
            errors: []
        };
        logger_1.logger.info(`Browser crawler initialized for job ${this.jobId}`, {
            jobId: this.jobId,
            baseUrl: this.baseUrl.toString(),
            options: this.options
        });
    }
    /**
     * Start the crawling process
     */
    async crawl() {
        if (this.isRunning) {
            throw new Error('Crawler is already running');
        }
        this.isRunning = true;
        this.stats.startTime = new Date();
        try {
            logger_1.logger.info(`Starting crawl job ${this.jobId}`, { jobId: this.jobId });
            while (this.urlQueue.length > 0 &&
                !this.isStopped &&
                this.visitedUrls.size < this.options.maxCrawledLinks &&
                this.results.size < this.options.limit) {
                const url = this.urlQueue.shift();
                if (this.visitedUrls.has(url)) {
                    continue; // Skip already visited URLs
                }
                this.visitedUrls.add(url);
                this.stats.visitedLinks++;
                try {
                    await this.processSingleUrl(url);
                    // Apply optional delay between requests to reduce server load
                    if (this.options.delay && this.options.delay > 0) {
                        await sleep(this.options.delay);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.stats.errors.push(`Error crawling ${url}: ${errorMessage}`);
                    logger_1.logger.error(`Error crawling URL: ${url}`, { error: errorMessage, jobId: this.jobId });
                }
            }
            logger_1.logger.info(`Crawl job ${this.jobId} completed`, {
                jobId: this.jobId,
                stats: {
                    totalUrls: this.visitedUrls.size,
                    extractedContent: this.results.size,
                    errors: this.stats.errors.length
                }
            });
            // Save results to Redis
            await this.saveResults();
            this.stats.endTime = new Date();
            return this.results;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`Crawl job ${this.jobId} failed`, { error: errorMessage, jobId: this.jobId });
            throw error;
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Stop the crawling process
     */
    stop() {
        this.isStopped = true;
        logger_1.logger.info(`Crawler job ${this.jobId} manually stopped`, { jobId: this.jobId });
    }
    /**
     * Process a single URL: fetch it, extract content and follow links
     */
    async processSingleUrl(url) {
        const page = await this.browser.newPage();
        try {
            logger_1.logger.debug(`Processing URL: ${url}`, { jobId: this.jobId });
            // Navigate to the URL with a timeout
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            // Extract content and links from the page
            const extractedData = await this.extractContent(page, url);
            // Store the result
            this.results.set(url, extractedData);
            this.stats.extractedContent++;
            // Process extracted links
            this.processExtractedLinks(extractedData.links, new url_1.URL(url));
            logger_1.logger.debug(`Processed URL successfully: ${url}`, {
                jobId: this.jobId,
                extractedLinks: extractedData.links.length
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.stats.errors.push(`Error processing ${url}: ${errorMessage}`);
            logger_1.logger.error(`Error processing URL: ${url}`, { error: errorMessage, jobId: this.jobId });
        }
        finally {
            await page.close().catch(err => {
                logger_1.logger.error(`Error closing page: ${err.message}`, { jobId: this.jobId });
            });
        }
    }
    /**
     * Extract content from a page
     */
    async extractContent(page, url) {
        // Get the page title
        const title = await page.title();
        // Get the page content - extract text from the body
        const content = await page.evaluate(() => {
            return document.body.innerText;
        });
        // Extract all links from the page
        const links = await page.evaluate(() => {
            const linkElements = Array.from(document.querySelectorAll('a[href]'));
            return linkElements.map(link => link.href);
        });
        // Extract metadata
        const metadata = await page.evaluate(() => {
            const metaTags = Array.from(document.querySelectorAll('meta[name], meta[property]'));
            const result = {};
            metaTags.forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property');
                const content = meta.getAttribute('content');
                if (name && content) {
                    result[name] = content;
                }
            });
            return result;
        });
        // Get HTML content
        const html = await page.content();
        return {
            url,
            title,
            content,
            links,
            metadata,
            html,
            timestamp: new Date()
        };
    }
    /**
     * Process extracted links, filter them and add them to the queue
     */
    processExtractedLinks(links, sourceUrl) {
        this.stats.totalLinks += links.length;
        for (const link of links) {
            try {
                // Skip empty or invalid links
                if (!link || link.startsWith('javascript:') || link.startsWith('#')) {
                    continue;
                }
                // Parse the URL
                const parsedUrl = new url_1.URL(link, sourceUrl.toString());
                const normalizedUrl = this.normalizeUrl(parsedUrl);
                // Skip if already visited or queued
                if (this.visitedUrls.has(normalizedUrl) || this.urlQueue.includes(normalizedUrl)) {
                    continue;
                }
                // Apply domain filters
                if (!this.shouldCrawlDomain(parsedUrl, this.baseUrl)) {
                    continue;
                }
                // Apply regex patterns
                if (!this.shouldCrawlUrl(normalizedUrl)) {
                    continue;
                }
                // All filters passed, add to queue
                this.urlQueue.push(normalizedUrl);
                this.stats.queuedLinks++;
            }
            catch (error) {
                // Skip invalid URLs
                logger_1.logger.debug(`Invalid URL found: ${link}`, { jobId: this.jobId });
            }
        }
    }
    /**
     * Normalize a URL by removing fragments and standardizing protocol
     */
    normalizeUrl(url) {
        // Create a new URL object to avoid modifying the original
        const normalized = new url_1.URL(url.toString());
        // Remove hash fragment
        normalized.hash = '';
        // Standardize protocol
        if (normalized.protocol === 'http:' && this.baseUrl.protocol === 'https:') {
            normalized.protocol = 'https:';
        }
        return normalized.toString();
    }
    /**
     * Determine if a URL should be crawled based on domain rules
     */
    shouldCrawlDomain(url, baseUrl) {
        // Check if URL is on the same domain
        if (url.hostname === baseUrl.hostname) {
            return true;
        }
        // Check if subdomains are allowed
        if (this.options.allowSubdomains) {
            // Check if the URL is a subdomain of the base domain
            const baseDomainParts = baseUrl.hostname.split('.');
            const urlDomainParts = url.hostname.split('.');
            if (baseDomainParts.length >= 2 && urlDomainParts.length >= 2) {
                const baseDomain = baseDomainParts.slice(-2).join('.');
                const urlDomain = urlDomainParts.slice(-2).join('.');
                if (baseDomain === urlDomain) {
                    return true;
                }
            }
        }
        // Check if external content links are allowed
        return !!this.options.allowExternalContentLinks;
    }
    /**
     * Determine if a URL should be crawled based on regex include/exclude patterns
     */
    shouldCrawlUrl(url) {
        // If no patterns are defined, allow all URLs
        if (this.includePatterns.length === 0 && this.excludePatterns.length === 0) {
            return true;
        }
        // Check exclude patterns first
        for (const pattern of this.excludePatterns) {
            if (pattern.test(url)) {
                return false;
            }
        }
        // If no include patterns are defined, allow all non-excluded URLs
        if (this.includePatterns.length === 0) {
            return true;
        }
        // Check include patterns
        for (const pattern of this.includePatterns) {
            if (pattern.test(url)) {
                return true;
            }
        }
        // Default to not crawling if no include patterns match
        return false;
    }
    /**
     * Get current crawler statistics
     */
    getStats() {
        return {
            ...this.stats,
            jobId: this.jobId
        };
    }
    /**
     * Save crawl results to Redis
     */
    async saveResults() {
        try {
            // Convert results to an array of objects
            const resultsArray = Array.from(this.results.entries()).map(([url, data]) => ({
                url,
                data
            }));
            // Save to Redis as a custom format
            const resultsData = {
                url: this.baseUrl.toString(),
                includePaths: this.options.includes,
                excludePaths: this.options.excludes,
                limit: this.options.limit,
                maxDepth: this.options.maxCrawledDepth,
                allowBackwardCrawling: this.options.allowBackwardCrawling,
                allowExternalContentLinks: this.options.allowExternalContentLinks,
                allowSubdomains: this.options.allowSubdomains,
                ignoreRobotsTxt: this.options.ignoreRobotsTxt,
                regexOnFullURL: this.options.regexOnFullURL,
                strategy: 'browser',
                scrapeOptions: {
                    resultsCount: resultsArray.length,
                    stats: this.getStats()
                }
            };
            await redisService.saveCrawl(this.jobId, resultsData);
            // For each result, save it separately to allow individual access
            for (const result of resultsArray) {
                const resultKey = `crawl:${this.jobId}:page:${encodeURIComponent(result.url)}`;
                await redisService.redisClient.set(resultKey, JSON.stringify(result.data));
                await redisService.redisClient.expire(resultKey, 86400); // 24 hours
            }
            logger_1.logger.info(`Saved crawl results for job ${this.jobId} to Redis`, {
                jobId: this.jobId,
                resultsCount: resultsArray.length
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to save crawl results to Redis for job ${this.jobId}`, {
                jobId: this.jobId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.BrowserCrawler = BrowserCrawler;
