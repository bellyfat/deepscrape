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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebCrawler = void 0;
const url_1 = require("url");
const cheerio = __importStar(require("cheerio"));
const robots_parser_1 = __importDefault(require("robots-parser"));
const logger_1 = require("../utils/logger");
const https = __importStar(require("https"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const playwright_scraper_1 = require("./playwright-scraper");
const crawler_1 = require("../types/crawler");
const browser_crawler_1 = require("./browser-crawler");
// Define HttpError class inline
class HttpError extends Error {
    constructor(message, statusCode, url) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.url = url;
    }
}
class WebCrawler {
    constructor({ jobId, initialUrl, baseUrl, includes, excludes, maxCrawledLinks = 10000, limit = 10000, maxCrawledDepth = 10, allowBackwardCrawling = false, allowExternalContentLinks = false, allowSubdomains = false, ignoreRobotsTxt = false, regexOnFullURL = false, strategy = crawler_1.CrawlStrategy.BFS, hooks = {}, useBrowserCrawler = false, // New option to enable browser-based crawling
     }) {
        this.visited = new Set();
        this.crawledUrls = new Map();
        this.sitemapsHit = new Set();
        this.browserCrawler = null;
        this.jobId = jobId;
        this.initialUrl = initialUrl;
        this.baseUrl = baseUrl ?? new url_1.URL(initialUrl).origin;
        this.includes = includes ?? [];
        this.excludes = excludes ?? [];
        this.limit = limit;
        this.robotsTxtUrl = `${this.baseUrl}${this.baseUrl.endsWith("/") ? "" : "/"}robots.txt`;
        this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, "");
        this.maxCrawledLinks = maxCrawledLinks ?? limit;
        this.maxCrawledDepth = maxCrawledDepth ?? 10;
        this.allowBackwardCrawling = allowBackwardCrawling ?? false;
        this.allowExternalContentLinks = allowExternalContentLinks ?? false;
        this.allowSubdomains = allowSubdomains ?? false;
        this.ignoreRobotsTxt = ignoreRobotsTxt ?? false;
        this.regexOnFullURL = regexOnFullURL ?? false;
        this.strategy = strategy ?? crawler_1.CrawlStrategy.BFS;
        this.hooks = hooks ?? {};
        this.useBrowserCrawler = useBrowserCrawler;
        this.scraper = new playwright_scraper_1.PlaywrightScraper();
        // Initialize browser crawler if needed
        if (this.useBrowserCrawler) {
            this.browserCrawler = new browser_crawler_1.BrowserCrawler({
                jobId,
                initialUrl,
                includes: includes || [], // Ensure includes is never undefined
                excludes: excludes || [], // Ensure excludes is never undefined
                maxCrawledLinks,
                limit,
                maxCrawledDepth,
                allowBackwardCrawling,
                allowExternalContentLinks,
                allowSubdomains,
                ignoreRobotsTxt,
                regexOnFullURL,
            });
        }
    }
    /**
     * Get the robots.txt content
     */
    async getRobotsTxt(skipTlsVerification = false) {
        try {
            let extraArgs = {};
            if (skipTlsVerification) {
                extraArgs = {
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                    }),
                };
            }
            // First try to get robots.txt using fetch
            const response = await (0, node_fetch_1.default)(this.robotsTxtUrl);
            if (response.ok) {
                const text = await response.text();
                this.importRobotsTxt(text);
                return text;
            }
            return '';
        }
        catch (error) {
            logger_1.logger.warn(`Error getting robots.txt: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }
    /**
     * Import robots.txt content
     */
    importRobotsTxt(robotsTxt) {
        try {
            this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, robotsTxt);
        }
        catch (error) {
            logger_1.logger.warn(`Error parsing robots.txt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Crawl a page and return its HTML content and links
     */
    async crawlPage(url) {
        // Execute before crawl hook
        if (this.hooks.beforeCrawl) {
            await this.hooks.beforeCrawl(url, {
                jobId: this.jobId,
                initialUrl: this.initialUrl,
                includes: this.includes,
                excludes: this.excludes,
            });
        }
        try {
            // Fetch the page
            const response = await (0, node_fetch_1.default)(url, {
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            });
            if (!response.ok) {
                throw new HttpError(`HTTP error: ${response.status} ${response.statusText}`, response.status, url);
            }
            let html = await response.text();
            // Apply afterPageLoad hook
            if (this.hooks.afterPageLoad) {
                html = await this.hooks.afterPageLoad(html, url);
            }
            // Apply beforeContentExtraction hook
            if (this.hooks.beforeContentExtraction) {
                html = await this.hooks.beforeContentExtraction(html, url);
            }
            // Extract links from the HTML
            const links = this.extractLinksFromHtml(html, url);
            // Apply afterUrlDiscovery hook
            let processedLinks = links;
            if (this.hooks.afterUrlDiscovery) {
                processedLinks = await this.hooks.afterUrlDiscovery(links, url);
            }
            return { html, links: processedLinks };
        }
        catch (error) {
            // Execute error hook
            if (this.hooks.onError) {
                await this.hooks.onError(error, url);
            }
            logger_1.logger.error(`Error crawling ${url}`, { error, url });
            return { html: '', links: [] };
        }
    }
    /**
     * Extract links from HTML using Cheerio
     */
    extractLinksFromHtml(html, baseUrl) {
        try {
            const $ = cheerio.load(html);
            const links = new Set();
            $('a[href]').each((_, element) => {
                const href = $(element).attr('href');
                if (href) {
                    try {
                        // Resolve relative URLs
                        const absoluteUrl = new url_1.URL(href, baseUrl).toString();
                        links.add(absoluteUrl);
                    }
                    catch (error) {
                        // Skip invalid URLs
                    }
                }
            });
            return Array.from(links);
        }
        catch (error) {
            logger_1.logger.error(`Error extracting links from HTML: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
    /**
     * Crawl the website using the configured crawler
     */
    async crawl() {
        // If browser-based crawling is enabled, use the BrowserCrawler
        if (this.useBrowserCrawler && this.browserCrawler) {
            logger_1.logger.info('Using browser-based crawler', {
                initialUrl: this.initialUrl,
                strategy: this.strategy
            });
            // Convert ExtractedData to string by getting HTML content
            const browserResults = await this.browserCrawler.crawl();
            const stringResults = new Map();
            // Convert the browser crawler results to the format expected by this class
            browserResults.forEach((data, url) => {
                stringResults.set(url, data.html);
            });
            return stringResults;
        }
        // HTTP-based crawling implementation
        try {
            // Load robots.txt if not ignoring it
            if (!this.ignoreRobotsTxt) {
                await this.getRobotsTxt();
            }
            // Initialize URL queue with the initial URL
            const urlQueue = [this.initialUrl];
            let crawledCount = 0;
            logger_1.logger.info(`Starting crawler with strategy: ${this.strategy}`, {
                initialUrl: this.initialUrl,
                strategy: this.strategy,
                limit: this.limit,
                maxDepth: this.maxCrawledDepth
            });
            // Process URLs until queue is empty or limits are reached
            while (urlQueue.length > 0 && crawledCount < this.limit) {
                let url;
                // Get next URL based on the selected strategy
                switch (this.strategy) {
                    case crawler_1.CrawlStrategy.DFS:
                        url = urlQueue.pop();
                        break;
                    case crawler_1.CrawlStrategy.BFS:
                    default:
                        url = urlQueue.shift();
                        break;
                }
                if (this.crawledUrls.has(url)) {
                    continue; // Skip already crawled URLs
                }
                logger_1.logger.info(`Crawling ${url} (${crawledCount + 1}/${this.limit})`, {
                    url,
                    crawledCount,
                    queueLength: urlQueue.length,
                    strategy: this.strategy
                });
                const { html, links } = await this.crawlPage(url);
                if (html) {
                    // Store the crawled HTML
                    this.crawledUrls.set(url, html);
                    crawledCount++;
                    // Filter and add discovered links to the queue
                    const filteredLinks = this.filterLinks(links, this.maxCrawledLinks, this.maxCrawledDepth);
                    if (filteredLinks.length > 0) {
                        logger_1.logger.debug(`Discovered ${filteredLinks.length} new links from ${url}`, {
                            count: filteredLinks.length,
                            sourceUrl: url
                        });
                        // Add links to queue based on crawl strategy
                        switch (this.strategy) {
                            case crawler_1.CrawlStrategy.DFS:
                                urlQueue.push(...filteredLinks);
                                break;
                            case crawler_1.CrawlStrategy.BFS:
                            default:
                                urlQueue.push(...filteredLinks);
                                break;
                        }
                    }
                }
            }
            logger_1.logger.info(`Crawling completed. Processed ${crawledCount} pages.`, {
                crawledCount,
                initialUrl: this.initialUrl
            });
            return this.crawledUrls;
        }
        catch (error) {
            logger_1.logger.error(`Error during crawl: ${error instanceof Error ? error.message : String(error)}`, {
                error
            });
            throw error;
        }
    }
    /**
     * Filter links based on crawler options
     */
    filterLinks(links, limit, maxDepth, fromMap = false) {
        if (this.initialUrl.endsWith("sitemap.xml") && fromMap) {
            return links.slice(0, limit);
        }
        return links
            .filter((link) => {
            let url;
            try {
                url = new url_1.URL(link.trim(), this.baseUrl);
            }
            catch (error) {
                logger_1.logger.debug(`Error processing link: ${link}`, {
                    link,
                    error,
                });
                return false;
            }
            const path = url.pathname;
            const depth = this.getURLDepth(url.toString());
            if (depth > maxDepth) {
                return false;
            }
            const excincPath = this.regexOnFullURL ? link : path;
            if (this.excludes.length > 0 && this.excludes[0] !== "") {
                if (this.excludes.some((excludePattern) => new RegExp(excludePattern).test(excincPath))) {
                    return false;
                }
            }
            if (this.includes.length > 0 && this.includes[0] !== "") {
                if (!this.includes.some((includePattern) => new RegExp(includePattern).test(excincPath))) {
                    return false;
                }
            }
            const normalizedInitialUrl = new url_1.URL(this.initialUrl);
            let normalizedLink;
            try {
                normalizedLink = new url_1.URL(link);
            }
            catch (_) {
                return false;
            }
            // Check if the link is from the same domain
            const initialHostname = normalizedInitialUrl.hostname.replace(/^www\./, "");
            const linkHostname = normalizedLink.hostname.replace(/^www\./, "");
            if (!this.allowExternalContentLinks && initialHostname !== linkHostname) {
                // For subdomains, check if they're allowed
                if (!this.allowSubdomains ||
                    !linkHostname.endsWith(initialHostname) ||
                    linkHostname === initialHostname) {
                    return false;
                }
            }
            if (!this.allowBackwardCrawling) {
                if (!normalizedLink.pathname.startsWith(normalizedInitialUrl.pathname)) {
                    return false;
                }
            }
            const isAllowed = this.ignoreRobotsTxt
                ? true
                : ((this.robots.isAllowed(link, "XeroxCrawler")) ?? true);
            if (!isAllowed) {
                logger_1.logger.debug(`Link disallowed by robots.txt: ${link}`);
                return false;
            }
            return true;
        })
            .slice(0, limit);
    }
    /**
     * Get the depth of a URL
     */
    getURLDepth(url) {
        try {
            const parsedUrl = new url_1.URL(url);
            const path = parsedUrl.pathname.endsWith('/')
                ? parsedUrl.pathname.slice(0, -1)
                : parsedUrl.pathname;
            if (path === '')
                return 0;
            return path.split('/').filter(Boolean).length;
        }
        catch (e) {
            return 0;
        }
    }
}
exports.WebCrawler = WebCrawler;
