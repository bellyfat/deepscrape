"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addScrapeJobToQueue = addScrapeJobToQueue;
exports.getJobResults = getJobResults;
var bullmq_1 = require("bullmq");
var ioredis_1 = require("ioredis");
var uuid_1 = require("uuid");
var crawl_redis_1 = require("../lib/crawl-redis");
var logger_1 = require("../lib/logger");
var WebCrawler_1 = require("../scraper/WebCrawler");
var playwright_scraper_1 = require("../scraper/playwright-scraper");
var axios_1 = require("axios");
// Redis connection singleton
var redisConnection = null;
function getRedisConnection() {
    if (!redisConnection) {
        var redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisConnection = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null // Required by BullMQ
        });
        redisConnection.on('error', function (err) {
            logger_1.logger.error('Redis connection error', { error: err });
        });
    }
    return redisConnection;
}
// Create job queue
var scrapeQueue = new bullmq_1.Queue('scraper-queue', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});
// Add a job to the queue
function addScrapeJobToQueue(data_1) {
    return __awaiter(this, arguments, void 0, function (data, jobId) {
        if (jobId === void 0) { jobId = (0, uuid_1.v4)(); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrapeQueue.add('scrape', data, {
                        jobId: jobId,
                        removeOnComplete: 100,
                        removeOnFail: 100
                    })];
                case 1:
                    _a.sent();
                    if (!data.crawlId) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, crawl_redis_1.addCrawlJob)(data.crawlId, jobId)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, jobId];
            }
        });
    });
}
// Get job results
function getJobResults(jobIds) {
    return __awaiter(this, void 0, void 0, function () {
        var jobs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!jobIds.length)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, Promise.all(jobIds.map(function (id) { return scrapeQueue.getJob(id); }))];
                case 1:
                    jobs = _a.sent();
                    return [2 /*return*/, jobs
                            .filter(function (job) { return job !== null; })
                            .map(function (job) { return job === null || job === void 0 ? void 0 : job.returnvalue; })
                            .filter(Boolean)];
            }
        });
    });
}
// Process scraper jobs
function processScrapeJob(job) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, url, mode, apiKey, crawlerOptions, scrapeOptions, crawlId, webhook, parent, jobLogger, isLocked, scraper, result, htmlContent, webhookError_1, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = job.data, url = _a.url, mode = _a.mode, apiKey = _a.apiKey, crawlerOptions = _a.crawlerOptions, scrapeOptions = _a.scrapeOptions, crawlId = _a.crawlId, webhook = _a.webhook, parent = _a.parent;
                    jobLogger = logger_1.logger.child({
                        jobId: job.id,
                        crawlId: crawlId,
                        url: url,
                        mode: mode,
                    });
                    jobLogger.info('Processing scrape job');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 17, , 20]);
                    if (!(mode === 'crawl' && crawlId)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, crawl_redis_1.isURLLocked)(crawlId, url)];
                case 2:
                    isLocked = _b.sent();
                    if (isLocked) {
                        jobLogger.debug('URL already processed, skipping', { url: url });
                        return [2 /*return*/, { success: true, skipped: true, url: url }];
                    }
                    return [4 /*yield*/, (0, crawl_redis_1.lockURL)(crawlId, url)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    scraper = new playwright_scraper_1.PlaywrightScraper();
                    return [4 /*yield*/, scraper.scrape(url, scrapeOptions)];
                case 5:
                    result = _b.sent();
                    htmlContent = result.content || '';
                    if (!(mode === 'crawl' && crawlId)) return [3 /*break*/, 7];
                    return [4 /*yield*/, processDiscoveredLinks(job, url, htmlContent, crawlId)];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 7:
                    if (!(mode === 'kickoff' && crawlId)) return [3 /*break*/, 10];
                    // This is the first job of a crawl, kickoff the crawling process
                    return [4 /*yield*/, kickoffCrawl(job, url, htmlContent, crawlId)];
                case 8:
                    // This is the first job of a crawl, kickoff the crawling process
                    _b.sent();
                    // Mark the kickoff as finished
                    return [4 /*yield*/, (0, crawl_redis_1.finishCrawlKickoff)(crawlId)];
                case 9:
                    // Mark the kickoff as finished
                    _b.sent();
                    _b.label = 10;
                case 10:
                    if (!webhook) return [3 /*break*/, 14];
                    _b.label = 11;
                case 11:
                    _b.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, axios_1.default.post(webhook, {
                            jobId: job.id,
                            url: url,
                            crawlId: crawlId,
                            result: result,
                            success: true,
                        })];
                case 12:
                    _b.sent();
                    return [3 /*break*/, 14];
                case 13:
                    webhookError_1 = _b.sent();
                    jobLogger.error('Failed to send webhook', { webhook: webhook, error: webhookError_1 });
                    return [3 /*break*/, 14];
                case 14:
                    if (!crawlId) return [3 /*break*/, 16];
                    return [4 /*yield*/, (0, crawl_redis_1.addCrawlJobDone)(crawlId, job.id, true)];
                case 15:
                    _b.sent();
                    _b.label = 16;
                case 16: return [2 /*return*/, {
                        success: true,
                        url: url,
                        content: result.content,
                        metadata: result.metadata,
                        title: result.title
                    }];
                case 17:
                    error_1 = _b.sent();
                    jobLogger.error('Error processing scrape job', { error: error_1 });
                    if (!crawlId) return [3 /*break*/, 19];
                    return [4 /*yield*/, (0, crawl_redis_1.addCrawlJobDone)(crawlId, job.id, false)];
                case 18:
                    _b.sent();
                    _b.label = 19;
                case 19: throw error_1;
                case 20: return [2 /*return*/];
            }
        });
    });
}
// Process discovered links from a crawled page
function processDiscoveredLinks(job, url, html, crawlId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, apiKey, crawlerOptions, scrapeOptions, jobLogger, crawl, crawler, links, filteredLinks, newJobIds, _i, filteredLinks_1, link, jobId, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = job.data, apiKey = _a.apiKey, crawlerOptions = _a.crawlerOptions, scrapeOptions = _a.scrapeOptions;
                    jobLogger = logger_1.logger.child({
                        jobId: job.id,
                        crawlId: crawlId,
                        url: url,
                        method: 'processDiscoveredLinks',
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 9, , 10]);
                    return [4 /*yield*/, (0, crawl_redis_1.getCrawl)(crawlId)];
                case 2:
                    crawl = _b.sent();
                    if (!crawl || crawl.cancelled) {
                        jobLogger.debug('Crawl not found or cancelled, skipping link discovery');
                        return [2 /*return*/];
                    }
                    crawler = new WebCrawler_1.WebCrawler({
                        crawlId: crawlId,
                        initialUrl: crawl.originUrl,
                        baseUrl: crawlerOptions.baseUrl,
                        includePaths: crawlerOptions.includePaths,
                        excludePaths: crawlerOptions.excludePaths,
                        limit: crawlerOptions.limit,
                        maxDepth: crawlerOptions.maxDepth,
                        allowSubdomains: crawlerOptions.allowSubdomains,
                        ignoreRobotsTxt: crawlerOptions.ignoreRobotsTxt,
                        allowExternalLinks: crawlerOptions.allowExternalLinks,
                        regexOnFullURL: crawlerOptions.regexOnFullURL,
                    });
                    if (crawl.robots) {
                        crawler.importRobotsTxt(crawl.robots);
                    }
                    links = crawler.extractLinksFromHTML(html, url);
                    filteredLinks = crawler.filterLinks(links, crawlerOptions.limit);
                    jobLogger.debug("Discovered ".concat(links.length, " links, ").concat(filteredLinks.length, " after filtering"));
                    newJobIds = [];
                    _i = 0, filteredLinks_1 = filteredLinks;
                    _b.label = 3;
                case 3:
                    if (!(_i < filteredLinks_1.length)) return [3 /*break*/, 8];
                    link = filteredLinks_1[_i];
                    return [4 /*yield*/, (0, crawl_redis_1.isURLLocked)(crawlId, link)];
                case 4:
                    // Check if URL is already locked (processed or in progress)
                    if (_b.sent()) {
                        return [3 /*break*/, 7];
                    }
                    // Lock the URL to prevent duplicate processing
                    return [4 /*yield*/, (0, crawl_redis_1.lockURL)(crawlId, link)];
                case 5:
                    // Lock the URL to prevent duplicate processing
                    _b.sent();
                    return [4 /*yield*/, addScrapeJobToQueue({
                            url: link,
                            mode: 'crawl',
                            apiKey: apiKey,
                            crawlerOptions: crawlerOptions,
                            scrapeOptions: scrapeOptions,
                            crawlId: crawlId,
                            parent: job.id,
                        })];
                case 6:
                    jobId = _b.sent();
                    newJobIds.push(jobId);
                    _b.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    jobLogger.debug("Added ".concat(newJobIds.length, " new jobs to the queue"));
                    return [3 /*break*/, 10];
                case 9:
                    error_2 = _b.sent();
                    jobLogger.error('Error processing discovered links', { error: error_2 });
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Kickoff the crawl process by processing the initial URL
function kickoffCrawl(job, url, html, crawlId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, apiKey, crawlerOptions, scrapeOptions, jobLogger, crawl, crawler, allLinks, skipTls, sitemapLinks, sitemapError_1, htmlLinks, uniqueLinks, filteredLinks, newJobIds, _i, filteredLinks_2, link, jobId, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = job.data, apiKey = _a.apiKey, crawlerOptions = _a.crawlerOptions, scrapeOptions = _a.scrapeOptions;
                    jobLogger = logger_1.logger.child({
                        jobId: job.id,
                        crawlId: crawlId,
                        url: url,
                        method: 'kickoffCrawl',
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 14, , 15]);
                    return [4 /*yield*/, (0, crawl_redis_1.getCrawl)(crawlId)];
                case 2:
                    crawl = _b.sent();
                    if (!crawl || crawl.cancelled) {
                        jobLogger.debug('Crawl not found or cancelled, skipping kickoff');
                        return [2 /*return*/];
                    }
                    // Lock the initial URL
                    return [4 /*yield*/, (0, crawl_redis_1.lockURL)(crawlId, url)];
                case 3:
                    // Lock the initial URL
                    _b.sent();
                    crawler = new WebCrawler_1.WebCrawler({
                        crawlId: crawlId,
                        initialUrl: crawl.originUrl,
                        baseUrl: crawlerOptions.baseUrl,
                        includePaths: crawlerOptions.includePaths,
                        excludePaths: crawlerOptions.excludePaths,
                        limit: crawlerOptions.limit,
                        maxDepth: crawlerOptions.maxDepth,
                        allowSubdomains: crawlerOptions.allowSubdomains,
                        ignoreRobotsTxt: crawlerOptions.ignoreRobotsTxt,
                        allowExternalLinks: crawlerOptions.allowExternalLinks,
                        regexOnFullURL: crawlerOptions.regexOnFullURL,
                    });
                    if (crawl.robots) {
                        crawler.importRobotsTxt(crawl.robots);
                    }
                    allLinks = [];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    skipTls = Boolean(scrapeOptions.skipTlsVerification);
                    return [4 /*yield*/, crawler.trySitemap(url, skipTls)];
                case 5:
                    sitemapLinks = _b.sent();
                    jobLogger.debug("Found ".concat(sitemapLinks.length, " links in sitemap"));
                    allLinks = allLinks.concat(sitemapLinks);
                    return [3 /*break*/, 7];
                case 6:
                    sitemapError_1 = _b.sent();
                    jobLogger.debug('Error getting sitemap, continuing with HTML parsing', { error: sitemapError_1 });
                    return [3 /*break*/, 7];
                case 7:
                    htmlLinks = crawler.extractLinksFromHTML(html, url);
                    allLinks = allLinks.concat(htmlLinks);
                    uniqueLinks = __spreadArray([], new Set(allLinks.map(function (link) { return (0, crawl_redis_1.normalizeURL)(link); })), true);
                    filteredLinks = crawler.filterLinks(uniqueLinks, crawlerOptions.limit);
                    jobLogger.debug("Discovered ".concat(allLinks.length, " links, ").concat(filteredLinks.length, " after filtering/deduplication"));
                    newJobIds = [];
                    _i = 0, filteredLinks_2 = filteredLinks;
                    _b.label = 8;
                case 8:
                    if (!(_i < filteredLinks_2.length)) return [3 /*break*/, 13];
                    link = filteredLinks_2[_i];
                    return [4 /*yield*/, (0, crawl_redis_1.isURLLocked)(crawlId, link)];
                case 9:
                    // Check if URL is already locked (processed or in progress)
                    if (_b.sent()) {
                        return [3 /*break*/, 12];
                    }
                    // Lock the URL to prevent duplicate processing
                    return [4 /*yield*/, (0, crawl_redis_1.lockURL)(crawlId, link)];
                case 10:
                    // Lock the URL to prevent duplicate processing
                    _b.sent();
                    return [4 /*yield*/, addScrapeJobToQueue({
                            url: link,
                            mode: 'crawl',
                            apiKey: apiKey,
                            crawlerOptions: crawlerOptions,
                            scrapeOptions: scrapeOptions,
                            crawlId: crawlId,
                            parent: job.id,
                        })];
                case 11:
                    jobId = _b.sent();
                    newJobIds.push(jobId);
                    _b.label = 12;
                case 12:
                    _i++;
                    return [3 /*break*/, 8];
                case 13:
                    jobLogger.debug("Added ".concat(newJobIds.length, " new jobs to the queue"));
                    return [3 /*break*/, 15];
                case 14:
                    error_3 = _b.sent();
                    jobLogger.error('Error in crawl kickoff', { error: error_3 });
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// Create worker to process jobs
var worker = new bullmq_1.Worker('scraper-queue', processScrapeJob, {
    connection: getRedisConnection(),
    concurrency: 5, // Process 5 jobs at a time
});
// Log worker events
worker.on('completed', function (job) {
    logger_1.logger.debug("Job ".concat(job.id, " completed"), { jobId: job.id });
});
worker.on('failed', function (job, err) {
    logger_1.logger.error("Job ".concat(job === null || job === void 0 ? void 0 : job.id, " failed"), { jobId: job === null || job === void 0 ? void 0 : job.id, error: err });
});
// Clean up on app termination
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, worker.close()];
            case 1:
                _a.sent();
                return [4 /*yield*/, scrapeQueue.close()];
            case 2:
                _a.sent();
                if (!redisConnection) return [3 /*break*/, 4];
                return [4 /*yield*/, redisConnection.quit()];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
exports.default = scrapeQueue;
