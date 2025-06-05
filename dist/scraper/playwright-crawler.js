"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightCrawler = void 0;
const playwright_1 = require("playwright");
const logger_1 = require("../utils/logger");
const url_1 = require("url");
/**
 * Browser-based crawler using Playwright
 * This implementation is based on Firecrawl's approach
 */
class PlaywrightCrawler {
    constructor() {
        this.browser = null;
        this.context = null;
    }
    /**
     * Initialize the browser with optimized settings
     */
    async initBrowser(options = {}) {
        if (this.browser)
            return;
        // Browser launch options similar to Firecrawl
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-notifications',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--mute-audio',
                '--hide-scrollbars'
            ],
            ...options.puppeteerLaunchOptions
        };
        logger_1.logger.info('Initializing browser with optimized settings');
        this.browser = await playwright_1.chromium.launch(launchOptions);
        // Advanced browser context configuration
        const userAgent = options.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.context = await this.browser.newContext({
            userAgent,
            viewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: options.skipTlsVerification || false,
            javaScriptEnabled: options.javascript !== false,
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Google Chrome";v="120", "Chromium";v="120", "Not=A?Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        // Block ad resources
        if (options.blockAds !== false) {
            await this.setupAdBlocking();
        }
    }
    /**
     * Set up ad blocking for better performance and to avoid tracking
     */
    async setupAdBlocking() {
        if (!this.context)
            return;
        const AD_DOMAINS = [
            'googlesyndication.com',
            'adservice.google.com',
            'doubleclick.net',
            'googleadservices.com',
            'google-analytics.com',
            'googletagmanager.com',
            'googletagservices.com',
            'amazon-adsystem.com',
            'facebook.com/tr',
            'facebook.net',
            'advertising.com',
            'adtechus.com',
            'quantserve.com',
            'scorecard.com',
            'zedo.com',
            'adblade.com',
            'adform.net',
            'adnxs.com',
            'criteo.com',
            'outbrain.com',
            'taboola.com'
        ];
        await this.context.route('**/*', async (route, request) => {
            const url = request.url();
            if (AD_DOMAINS.some(domain => url.includes(domain))) {
                logger_1.logger.debug(`Blocking ad resource: ${url}`);
                return route.abort();
            }
            return route.continue();
        });
    }
    /**
     * Crawl a page and extract links using browser-based rendering
     * This allows discovery of JavaScript-generated links
     */
    async crawlPage(url, options = {}) {
        try {
            // Initialize browser if needed
            if (!this.browser || !this.context) {
                await this.initBrowser(options);
            }
            if (!this.context) {
                throw new Error('Browser context initialization failed');
            }
            // Create a new page
            const page = await this.context.newPage();
            try {
                // Navigate to the URL
                logger_1.logger.info(`Navigating to ${url} with browser rendering`);
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: options.timeout || 30000
                });
                // Wait for selector if specified
                if (options.waitForSelector) {
                    await page.waitForSelector(options.waitForSelector, {
                        timeout: options.timeout || 30000
                    });
                }
                // Wait additional time if specified
                if (options.waitForTimeout && options.waitForTimeout > 0) {
                    await page.waitForTimeout(options.waitForTimeout);
                }
                // Execute any custom actions if needed
                if (options.actions && options.actions.length > 0) {
                    await this.performActions(page, options.actions);
                }
                // Perform auto-scroll to load lazy-loaded content
                await this.autoScroll(page);
                // Extract HTML after JavaScript execution
                const html = await page.content();
                // Extract links using browser context
                // This ensures we get JavaScript-generated links
                const links = await this.extractLinks(page, url);
                await page.close();
                return { html, links };
            }
            catch (error) {
                logger_1.logger.error(`Error during browser crawling of ${url}: ${error}`);
                await page.close();
                throw error;
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to crawl ${url}: ${error}`);
            return { html: '', links: [] };
        }
    }
    /**
     * Extract links from the rendered page
     */
    async extractLinks(page, baseUrl) {
        try {
            // Extract all links from the page using browser execution
            // This captures JavaScript-generated links that wouldn't be in the source HTML
            const links = await page.evaluate((baseUrl) => {
                const linkElements = document.querySelectorAll('a[href]');
                const extractedLinks = [];
                for (const element of Array.from(linkElements)) {
                    const href = element.getAttribute('href');
                    if (href) {
                        try {
                            // Resolve relative URLs
                            const url = new url_1.URL(href, baseUrl);
                            extractedLinks.push(url.href);
                        }
                        catch (e) {
                            // Invalid URL, ignore
                        }
                    }
                }
                return [...new Set(extractedLinks)]; // Deduplicate
            }, baseUrl);
            return links;
        }
        catch (error) {
            logger_1.logger.error(`Error extracting links from browser: ${error}`);
            return [];
        }
    }
    /**
     * Perform auto-scrolling to load lazy-loaded content
     */
    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
    /**
     * Perform custom actions on the page
     */
    async performActions(page, actions) {
        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'click':
                        if (action.selector) {
                            await page.click(action.selector);
                        }
                        break;
                    case 'scroll':
                        await page.evaluate((position) => {
                            window.scrollTo(0, position);
                        }, action.position || 0);
                        break;
                    case 'wait':
                        await page.waitForTimeout(action.timeout || 1000);
                        break;
                    case 'fill':
                        if (action.selector && action.value) {
                            await page.fill(action.selector, action.value);
                        }
                        break;
                    case 'select':
                        if (action.selector && action.value) {
                            await page.selectOption(action.selector, action.value);
                        }
                        break;
                }
                // Wait a bit after each action
                await page.waitForTimeout(500);
            }
            catch (error) {
                if (!action.optional) {
                    throw error;
                }
                logger_1.logger.warn(`Optional action failed: ${action.type}`, { error });
            }
        }
    }
    /**
     * Close the browser when done
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
        }
    }
}
exports.PlaywrightCrawler = PlaywrightCrawler;
