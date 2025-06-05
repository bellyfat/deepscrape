"use strict";
/**
 * Custom error types for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserError = exports.CrawlError = exports.HttpError = void 0;
/**
 * HttpError represents an error returned by an HTTP request
 */
class HttpError extends Error {
    constructor(message, statusCode, url) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.url = url;
    }
}
exports.HttpError = HttpError;
/**
 * CrawlError represents an error that occurred during crawling
 */
class CrawlError extends Error {
    constructor(message, url) {
        super(message);
        this.name = 'CrawlError';
        this.url = url;
    }
}
exports.CrawlError = CrawlError;
/**
 * BrowserError represents an error that occurred in the browser
 */
class BrowserError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BrowserError';
    }
}
exports.BrowserError = BrowserError;
