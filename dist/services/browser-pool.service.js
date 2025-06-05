"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPool = void 0;
const playwright_1 = require("playwright");
const logger_1 = require("../utils/logger");
const events_1 = require("events");
const user_agents_1 = __importDefault(require("user-agents"));
const types_1 = require("../types");
class BrowserPool extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.instances = [];
        this.workQueue = [];
        this.isProcessing = false;
        this.proxyList = [];
        this.proxyIndex = 0;
        this.userAgents = new user_agents_1.default();
        this.maxInstances = options.maxInstances || 3;
        this.maxTabsPerInstance = options.maxTabsPerInstance || 5;
        this.idleTimeout = options.idleTimeout || 300000; // 5 minutes
        this.proxyList = options.proxyList || [];
        logger_1.logger.info(`Initializing BrowserPool with ${this.maxInstances} instances, ${this.maxTabsPerInstance} tabs per instance`);
        // Start maintenance interval
        setInterval(() => this.performMaintenance(), 60000); // Check every minute
    }
    /**
     * Get a random user agent
     */
    getRandomUserAgent() {
        return this.userAgents.toString();
    }
    /**
     * Get the next proxy from the rotation pool
     */
    getNextProxy() {
        if (this.proxyList.length === 0)
            return undefined;
        const proxy = this.proxyList[this.proxyIndex];
        this.proxyIndex = (this.proxyIndex + 1) % this.proxyList.length;
        return proxy;
    }
    /**
     * Initialize a new browser instance
     */
    async createBrowserInstance(options) {
        const userAgent = options.userAgent || this.getRandomUserAgent();
        logger_1.logger.info(`Launching new browser instance with user agent: ${userAgent}`);
        const browser = await playwright_1.chromium.launch({
            headless: true
        });
        const contextOptions = {
            userAgent,
            viewport: options.viewport || { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
            bypassCSP: true,
            javaScriptEnabled: true,
            extraHTTPHeaders: options.referrer ? { referer: options.referrer } : undefined
        };
        // Add proxy if specified or get from rotation pool
        let proxyUrl = options.proxy;
        if (!proxyUrl && options.proxyRotation && this.proxyList.length > 0) {
            proxyUrl = this.getNextProxy();
        }
        if (proxyUrl) {
            contextOptions.proxy = {
                server: proxyUrl
            };
            if (options.proxyUsername && options.proxyPassword) {
                contextOptions.proxy.username = options.proxyUsername;
                contextOptions.proxy.password = options.proxyPassword;
            }
            logger_1.logger.info(`Using proxy: ${proxyUrl}`);
        }
        const context = await browser.newContext(contextOptions);
        if (options.stealthMode) {
            await this.setupStealthMode(context);
            logger_1.logger.info('Stealth mode configured for browser context');
        }
        if (options.blockResources === true) {
            await this.setupResourceBlocking(context);
            logger_1.logger.info('Resource blocking configured');
        }
        const instance = {
            browser,
            context,
            tabs: [],
            userAgent,
            options
        };
        // Pre-create tabs
        for (let i = 0; i < this.maxTabsPerInstance; i++) {
            const page = await context.newPage();
            instance.tabs.push({
                page,
                inUse: false,
                lastUsed: Date.now()
            });
        }
        return instance;
    }
    /**
     * Setup stealth mode to avoid detection
     */
    async setupStealthMode(context) {
        await context.addInitScript(function () {
            // Store original navigator and WebGL
            const _originalNavigator = window.navigator;
            const _originalWebGL = window.WebGLRenderingContext.prototype.getParameter;
            // Override WebGL fingerprinting methods
            const getParameterProxyHandler = {
                apply: function (target, thisArg, args) {
                    // Return modified values for fingerprinting parameters
                    const param = args[0];
                    if (param === 37445) {
                        return 'Google Inc. (Intel)';
                    }
                    if (param === 37446) {
                        return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics OpenGL 4.1)';
                    }
                    return target.apply(thisArg, args);
                }
            };
            // Apply the proxy to WebGL methods
            if (window.WebGLRenderingContext) {
                window.WebGLRenderingContext.prototype.getParameter = new Proxy(window.WebGLRenderingContext.prototype.getParameter, getParameterProxyHandler);
            }
            // Mock permissions API
            if (navigator.permissions) {
                navigator.permissions.query = async function (permissionDesc) {
                    return Promise.resolve({
                        state: "granted",
                        onchange: null
                    });
                };
            }
            // Modify navigator properties to avoid detection
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [];
                    Object.defineProperty(plugins, 'length', { value: 1 });
                    return plugins;
                }
            });
        });
    }
    /**
     * Setup resource blocking for the browser context
     */
    async setupResourceBlocking(context) {
        await context.route('**/*', (route, request) => {
            const url = request.url();
            const resourceType = request.resourceType();
            // Block ad serving domains
            const isAdDomain = types_1.AD_SERVING_DOMAINS.some(domain => url.includes(domain));
            // Block unnecessary resource types
            const blockResourceTypes = ['image', 'media', 'font', 'other', 'websocket', 'eventsource'];
            // Block tracking and analytics scripts
            const trackingKeywords = ['tracking', 'analytics', 'telemetry', 'metrics', 'stats', 'pixel'];
            const isTrackingResource = trackingKeywords.some(keyword => url.toLowerCase().includes(keyword));
            // Determine if request should be blocked
            const shouldBlock = isAdDomain || isTrackingResource || blockResourceTypes.includes(resourceType);
            if (shouldBlock) {
                route.abort();
            }
            else {
                route.continue();
            }
        });
    }
    /**
     * Get an available tab from the pool or create a new one if needed
     */
    async getAvailableTab(options) {
        // First, look for any existing instance with an available tab
        for (const instance of this.instances) {
            const availableTab = instance.tabs.find(tab => !tab.inUse);
            if (availableTab) {
                availableTab.inUse = true;
                availableTab.lastUsed = Date.now();
                return { instance, tab: availableTab };
            }
        }
        // If we have room for a new browser instance, create one
        if (this.instances.length < this.maxInstances) {
            try {
                const instance = await this.createBrowserInstance(options);
                this.instances.push(instance);
                // Get the first tab
                const tab = instance.tabs[0];
                tab.inUse = true;
                tab.lastUsed = Date.now();
                return { instance, tab };
            }
            catch (error) {
                logger_1.logger.error(`Failed to create browser instance: ${error}`);
                // If we can't create a new instance, try to wait for an existing one
                if (this.instances.length > 0) {
                    logger_1.logger.info('Falling back to waiting for an available tab');
                }
                else {
                    throw new Error(`Failed to create browser instance: ${error}`);
                }
            }
        }
        // If we're at capacity or creation failed, wait for a tab to become available
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds total wait time
            const checkInterval = setInterval(() => {
                attempts++;
                // Check if any tab is available
                for (const instance of this.instances) {
                    const availableTab = instance.tabs.find(tab => !tab.inUse);
                    if (availableTab) {
                        clearInterval(checkInterval);
                        availableTab.inUse = true;
                        availableTab.lastUsed = Date.now();
                        resolve({ instance, tab: availableTab });
                        return;
                    }
                }
                // Give up after max attempts
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('No browser tabs became available after 10 seconds'));
                }
            }, 500);
        });
    }
    /**
     * Release a tab back to the pool
     */
    releaseTab(tab) {
        tab.inUse = false;
        tab.lastUsed = Date.now();
        // Process next item in queue if available
        this.processQueue();
    }
    /**
     * Process the work queue
     */
    async processQueue() {
        if (this.isProcessing || this.workQueue.length === 0)
            return;
        this.isProcessing = true;
        try {
            const workItem = this.workQueue.shift();
            if (!workItem) {
                this.isProcessing = false;
                return;
            }
            try {
                const { instance, tab } = await this.getAvailableTab(workItem.options);
                try {
                    const result = await this.processUrl(tab.page, workItem.url, workItem.options);
                    workItem.resolve(result);
                }
                catch (error) {
                    workItem.reject(error);
                }
                finally {
                    this.releaseTab(tab);
                }
            }
            catch (error) {
                workItem.reject(error);
                this.isProcessing = false;
                this.processQueue();
            }
        }
        catch (error) {
            logger_1.logger.error(`Error processing queue: ${error}`);
            this.isProcessing = false;
        }
    }
    /**
     * Process a URL with the given tab
     */
    async processUrl(page, url, options) {
        logger_1.logger.info(`Processing URL with pooled browser: ${url}`);
        let timeoutRetries = 0;
        const maxTimeoutRetries = options.maxRetries || 2;
        let status = 0;
        try {
            // Add randomized human-like behavior
            await this.addHumanBehavior(page);
            // Navigation with timeout retry logic
            let response;
            while (timeoutRetries <= maxTimeoutRetries) {
                try {
                    // Set a shorter initial navigation timeout
                    response = await page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 // 30 seconds
                    });
                    break;
                }
                catch (error) {
                    // Check if this is a timeout error
                    if (error instanceof Error && error.message.includes('timeout')) {
                        timeoutRetries++;
                        if (timeoutRetries > maxTimeoutRetries) {
                            throw error;
                        }
                        logger_1.logger.warn(`Navigation timeout for ${url}, retrying (${timeoutRetries}/${maxTimeoutRetries})...`);
                        // Clear browser cache and cookies between attempts
                        try {
                            await page.context().clearCookies();
                            await page.evaluate(() => {
                                if (window.localStorage)
                                    localStorage.clear();
                                if (window.sessionStorage)
                                    sessionStorage.clear();
                            });
                        }
                        catch (e) {
                            // Ignore cleanup errors
                            logger_1.logger.debug(`Error during cleanup: ${e}`);
                        }
                        try {
                            // Try with longer timeout and different strategy
                            response = await page.goto(url, {
                                waitUntil: 'load',
                                timeout: 45000 // 45 seconds
                            });
                            logger_1.logger.info(`Retry succeeded with 'load' strategy for ${url}`);
                            break;
                        }
                        catch (retryError) {
                            if (retryError instanceof Error && retryError.message.includes('timeout')) {
                                logger_1.logger.warn(`Retry failed with 'load' strategy for ${url}, trying again...`);
                                continue;
                            }
                            throw retryError;
                        }
                    }
                    throw error;
                }
            }
            status = response?.status() || 200;
            logger_1.logger.info(`Page loaded with status: ${status}`);
            if (status >= 400) {
                if (status === 429) {
                    throw new Error(`Too Many Requests (429) for URL: ${url}`);
                }
                logger_1.logger.warn(`Error status code: ${status} for URL: ${url}`);
                return {
                    content: '',
                    links: [],
                    url,
                    status
                };
            }
            // Wait for specified time
            const waitTime = options.waitTime || 1000;
            await page.waitForTimeout(waitTime);
            // Add human-like scrolling
            await this.simulateHumanScrolling(page, options.maxScrolls || 3);
            // Extract links from the page
            const links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors
                    .map(anchor => anchor.href)
                    .filter(href => href && typeof href === 'string' && !href.startsWith('javascript:'))
                    .map(href => {
                    try {
                        return new URL(href).toString();
                    }
                    catch {
                        return null;
                    }
                })
                    .filter(Boolean);
            });
            logger_1.logger.info(`Extracted ${links.length} links from page`);
            // Get the page content and title
            const content = await page.content();
            const title = await page.title();
            return {
                content,
                links,
                url,
                title,
                status
            };
        }
        catch (error) {
            logger_1.logger.error(`Error processing ${url}: ${error}`);
            throw error;
        }
    }
    /**
     * Add randomized human-like behavior before page navigation
     */
    async addHumanBehavior(page) {
        try {
            const viewport = page.viewportSize();
            if (viewport) {
                const { width, height } = viewport;
                const movements = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < movements; i++) {
                    const x = Math.floor(Math.random() * width);
                    const y = Math.floor(Math.random() * (height / 2));
                    await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
                    await page.waitForTimeout(100 + Math.floor(Math.random() * 200));
                }
            }
        }
        catch (error) {
            // Don't fail if human behavior simulation fails
            logger_1.logger.debug('Error simulating human behavior, continuing with navigation');
        }
    }
    /**
     * Simulate human-like scrolling behavior
     */
    async simulateHumanScrolling(page, maxScrolls) {
        try {
            for (let i = 0; i < maxScrolls; i++) {
                const { scrollTop, scrollHeight, clientHeight } = await page.evaluate(() => {
                    return {
                        scrollTop: document.documentElement.scrollTop,
                        scrollHeight: document.documentElement.scrollHeight,
                        clientHeight: document.documentElement.clientHeight
                    };
                });
                if (scrollTop + clientHeight >= scrollHeight) {
                    break;
                }
                const scrollAmount = 100 + Math.floor(Math.random() * (clientHeight - 100));
                await page.evaluate((scrollAmount) => {
                    window.scrollBy(0, scrollAmount);
                }, scrollAmount);
                const pauseTime = 500 + Math.floor(Math.random() * 1500);
                await page.waitForTimeout(pauseTime);
            }
        }
        catch (error) {
            logger_1.logger.debug('Error during human-like scrolling, continuing with extraction');
        }
    }
    /**
     * Submit a URL for processing by the browser pool
     */
    async processUrlWithPool(url, options = {}) {
        return new Promise((resolve, reject) => {
            // Set a timeout for the overall process
            const timeout = setTimeout(() => {
                reject(new Error(`Pool processing timeout for URL: ${url}`));
            }, 120000); // 2-minute global timeout
            this.workQueue.push({
                url,
                options,
                resolve: (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            this.processQueue();
        });
    }
    /**
     * Close all browser instances
     */
    async close() {
        logger_1.logger.info(`Closing ${this.instances.length} browser instances`);
        for (const instance of this.instances) {
            try {
                await instance.browser.close();
            }
            catch (error) {
                logger_1.logger.error(`Error closing browser: ${error}`);
            }
        }
        this.instances = [];
    }
    /**
     * Perform maintenance on the browser pool
     */
    async performMaintenance() {
        const now = Date.now();
        // Close idle browsers if they exceed the idle timeout
        const instancesToRemove = [];
        for (const instance of this.instances) {
            // Check if all tabs are idle
            const allIdle = instance.tabs.every(tab => !tab.inUse);
            if (allIdle) {
                // Check if all tabs have been idle for longer than the timeout
                const oldestActivity = Math.max(...instance.tabs.map(tab => tab.lastUsed));
                if (now - oldestActivity > this.idleTimeout) {
                    instancesToRemove.push(instance);
                }
            }
        }
        // Close idle instances
        for (const instance of instancesToRemove) {
            try {
                logger_1.logger.info(`Closing idle browser instance (${Math.floor((now - Math.max(...instance.tabs.map(tab => tab.lastUsed))) / 1000)}s inactive)`);
                await instance.browser.close();
                this.instances = this.instances.filter(i => i !== instance);
            }
            catch (error) {
                logger_1.logger.error(`Error closing idle browser: ${error}`);
            }
        }
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            totalInstances: this.instances.length,
            queueSize: this.workQueue.length,
            activeTabs: this.instances.reduce((sum, instance) => sum + instance.tabs.filter(tab => tab.inUse).length, 0),
            totalTabs: this.instances.reduce((sum, instance) => sum + instance.tabs.length, 0)
        };
    }
}
exports.BrowserPool = BrowserPool;
