"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
/**
 * Service that manages a shared browser instance for all crawlers
 */
class BrowserService {
    constructor() {
        this.browser = null;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:94.0) Gecko/20100101 Firefox/94.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        ];
        // Private constructor to enforce singleton pattern
    }
    static getInstance() {
        if (!BrowserService.instance) {
            BrowserService.instance = new BrowserService();
        }
        return BrowserService.instance;
    }
    /**
     * Initialize the browser with the specified options
     */
    async initializeBrowser(options = {}) {
        if (this.browser) {
            await this.closeBrowser();
        }
        const launchOptions = {
            headless: options.headless === 'new' ? true : options.headless ?? true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
            ]
        };
        // Add ad blocking if requested
        if (options.adBlocking) {
            launchOptions.args?.push('--disable-extensions', '--block-new-web-contents', '--disable-features=site-per-process');
        }
        this.browser = await puppeteer_1.default.launch(launchOptions);
        // Set up browser close handlers
        this.browser.on('disconnected', () => {
            logger_1.logger.info('Browser disconnected');
            this.browser = null;
        });
        logger_1.logger.info('Browser initialized successfully');
        return this.browser;
    }
    /**
     * Get the current browser instance or initialize a new one if none exists
     */
    async getBrowser() {
        if (!this.browser) {
            return this.initializeBrowser();
        }
        return this.browser;
    }
    /**
     * Close the browser instance if it exists
     */
    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                logger_1.logger.info('Browser closed successfully');
            }
            catch (error) {
                logger_1.logger.error('Error closing browser', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
    /**
     * Get a random user agent from the list
     */
    getRandomUserAgent() {
        const randomIndex = Math.floor(Math.random() * this.userAgents.length);
        return this.userAgents[randomIndex];
    }
    /**
     * Generate a unique job ID
     */
    generateJobId() {
        return (0, uuid_1.v4)();
    }
    /**
     * Create a new page in the browser
     */
    async newPage() {
        if (!this.browser) {
            await this.initializeBrowser();
        }
        if (!this.browser) {
            throw new Error('Browser is not initialized');
        }
        const page = await this.browser.newPage();
        // Set default timeout and user agent
        page.setDefaultTimeout(30000);
        await page.setUserAgent(this.getRandomUserAgent());
        return page;
    }
    /**
     * Set a cookie on a page
     */
    async setCookie(page, name, value, domain) {
        await page.setCookie({
            name,
            value,
            domain,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        });
    }
    /**
     * Execute code in the context of the page and return the result
     */
    async evaluateOnPage(page, fn, ...args) {
        return page.evaluate(fn, ...args);
    }
    /**
     * Log a message with the page URL for context
     */
    logWithPageContext(page, level, msg) {
        const url = page.url();
        const context = { url, pageTitle: page.title() };
        switch (level) {
            case 'info':
                logger_1.logger.info(msg, context);
                break;
            case 'warn':
                logger_1.logger.warn(msg, context);
                break;
            case 'error':
                logger_1.logger.error(msg, context);
                break;
            case 'debug':
                logger_1.logger.debug(msg, context);
                break;
        }
    }
    /**
     * Extract all links from a page with advanced techniques
     */
    async extractLinks(page, baseUrl) {
        try {
            // Scroll page to reveal any lazy-loaded content
            await this.scrollPage(page);
            // Extract links using JavaScript evaluation for better coverage
            const links = await page.evaluate((base) => {
                const baseUrl = new URL(base);
                const allLinks = [];
                // Get href attributes from all <a> tags
                document.querySelectorAll('a[href]').forEach(el => {
                    try {
                        const href = el.href;
                        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                            allLinks.push(href);
                        }
                    }
                    catch (e) {
                        // Skip invalid links
                    }
                });
                // Check for other potential navigation elements (e.g., buttons with onClick)
                document.querySelectorAll('[onclick]').forEach(el => {
                    const onClickAttr = el.getAttribute('onclick');
                    if (onClickAttr && onClickAttr.includes('location') && onClickAttr.includes('.href')) {
                        try {
                            // Extract URLs from onclick handlers
                            const matches = onClickAttr.match(/location(?:.*)href\s*=\s*['"]([^'"]+)['"]/);
                            if (matches && matches[1]) {
                                try {
                                    const url = new URL(matches[1], baseUrl.origin);
                                    allLinks.push(url.href);
                                }
                                catch (e) {
                                    // Skip invalid URLs
                                }
                            }
                        }
                        catch (e) {
                            // Skip on error
                        }
                    }
                });
                // Return unique links
                return [...new Set(allLinks)];
            }, baseUrl);
            return links;
        }
        catch (error) {
            logger_1.logger.error('Error extracting links', { error, url: baseUrl });
            return [];
        }
    }
    /**
     * Scroll page to reveal lazy-loaded content
     */
    async scrollPage(page) {
        try {
            // Scroll down the page gradually to trigger lazy loading
            await page.evaluate(async () => {
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                const totalHeight = document.body.scrollHeight;
                const viewportHeight = window.innerHeight;
                let scrollTop = 0;
                while (scrollTop < totalHeight) {
                    window.scrollTo(0, scrollTop);
                    await delay(100);
                    scrollTop += viewportHeight / 2;
                }
                // Scroll back to top
                window.scrollTo(0, 0);
            });
        }
        catch (error) {
            logger_1.logger.warn('Error during page scrolling', { error });
        }
    }
}
exports.BrowserService = BrowserService;
