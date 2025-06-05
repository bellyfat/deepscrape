"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = exports.formatDate = exports.truncate = exports.isValidUrl = exports.randomBetween = exports.sleep = void 0;
/**
 * Utility to pause execution for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
/**
 * Generate a random number between min and max (inclusive)
 */
const randomBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};
exports.randomBetween = randomBetween;
/**
 * Check if a string is a valid URL
 */
const isValidUrl = (str) => {
    try {
        new URL(str);
        return true;
    }
    catch (err) {
        return false;
    }
};
exports.isValidUrl = isValidUrl;
/**
 * Truncate a string to a maximum length with ellipsis
 */
const truncate = (str, maxLength) => {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength) + '...';
};
exports.truncate = truncate;
/**
 * Format a date to ISO string without milliseconds
 */
const formatDate = (date) => {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};
exports.formatDate = formatDate;
/**
 * Retry a function with exponential backoff
 */
const retry = async (fn, options = {}) => {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, factor = 2, onRetry = () => { } } = options;
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        }
        catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
                throw error;
            }
            const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);
            if (error instanceof Error) {
                onRetry(error, attempt);
            }
            await (0, exports.sleep)(delay);
        }
    }
};
exports.retry = retry;
