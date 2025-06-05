"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeURL = normalizeURL;
exports.isURLLocked = isURLLocked;
exports.lockURL = lockURL;
exports.lockURLs = lockURLs;
const redis_service_1 = require("../services/redis.service");
const logger_1 = require("../utils/logger");
const url_1 = require("url");
// Normalize URL to ensure consistent storage and lookup
function normalizeURL(url) {
    try {
        const parsedUrl = new url_1.URL(url);
        return parsedUrl.href;
    }
    catch (error) {
        logger_1.logger.error(`Error normalizing URL: ${url}`, { error });
        return url;
    }
}
/**
 * Check if a URL is already locked (being processed or already processed)
 */
async function isURLLocked(crawlId, url) {
    try {
        const normalizedUrl = normalizeURL(url);
        const key = `crawl:${crawlId}:url:${normalizedUrl}`;
        const result = await redis_service_1.redisClient.exists(key);
        return result === 1;
    }
    catch (error) {
        logger_1.logger.error(`Error checking if URL is locked: ${url}`, { error, crawlId, url });
        return false;
    }
}
/**
 * Lock a URL to prevent duplicate processing
 * Returns true if the URL was successfully locked (not previously locked)
 */
async function lockURL(crawlId, url, ttl = 86400) {
    try {
        const normalizedUrl = normalizeURL(url);
        const key = `crawl:${crawlId}:url:${normalizedUrl}`;
        // Use SETNX to only set if the key doesn't exist
        const result = await redis_service_1.redisClient.setnx(key, 'locked');
        if (result === 1) {
            // Set expiration time
            await redis_service_1.redisClient.expire(key, ttl); // 24 hours TTL
            logger_1.logger.debug(`URL locked: ${url}`, { crawlId, url });
            return true;
        }
        logger_1.logger.debug(`URL already locked: ${url}`, { crawlId, url });
        return false;
    }
    catch (error) {
        logger_1.logger.error(`Error locking URL: ${url}`, { error, crawlId, url });
        return false;
    }
}
/**
 * Lock multiple URLs at once using a pipeline for efficiency
 * Returns the count of successfully locked URLs
 */
async function lockURLs(crawlId, urls, ttl = 86400) {
    if (urls.length === 0)
        return 0;
    const pipeline = redis_service_1.redisClient.pipeline();
    const normalizedUrls = urls.map(url => normalizeURL(url));
    try {
        // Create SETNX commands for all URLs
        normalizedUrls.forEach(url => {
            const key = `crawl:${crawlId}:url:${url}`;
            pipeline.setnx(key, 'locked');
            pipeline.expire(key, ttl);
        });
        // Execute the pipeline
        const results = await pipeline.exec();
        // Count successful locks (every other result is for SETNX, others are for EXPIRE)
        let successCount = 0;
        if (results) {
            for (let i = 0; i < results.length; i += 2) {
                const setnxResult = results[i];
                if (setnxResult && setnxResult[1] === 1) {
                    successCount++;
                }
            }
        }
        logger_1.logger.debug(`Locked ${successCount}/${urls.length} URLs`, { crawlId });
        return successCount;
    }
    catch (error) {
        logger_1.logger.error('Error locking URLs in batch', { error, crawlId, urlCount: urls.length });
        return 0;
    }
}
