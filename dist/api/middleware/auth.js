"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = validateApiKey;
var logger_1 = require("../../lib/logger");
/**
 * Validates the API key in the request headers
 * Accepts either X-API-Key or Authorization header (with 'Bearer' prefix)
 */
function validateApiKey(req, res, next) {
    var _a;
    try {
        // Get API key from headers
        var apiKey = req.headers['x-api-key'] ||
            (((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer ')) ?
                req.headers.authorization.substring(7) : '');
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key is required',
                message: 'Please provide an API key in the X-API-Key header',
            });
        }
        // For testing purposes, allow a test key
        if (process.env.NODE_ENV === 'development' && apiKey === 'test-key') {
            return next();
        }
        // Check if API key is valid
        var validKey = process.env.API_KEY === apiKey;
        if (!validKey) {
            logger_1.logger.warn('Invalid API key used', { apiKey: apiKey });
            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is invalid',
            });
        }
        // API key is valid, continue
        next();
    }
    catch (error) {
        logger_1.logger.error('Error validating API key', { error: error });
        return res.status(500).json({
            success: false,
            error: 'Error validating API key',
            message: 'An unexpected error occurred while validating the API key',
        });
    }
}
