"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Middleware to validate requests using Zod schemas
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            // Validate request body against schema
            const result = schema.safeParse(req.body);
            if (!result.success) {
                logger_1.logger.warn(`Request validation failed: ${JSON.stringify(result.error)}`);
                return res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: result.error.errors
                });
            }
            // Validation successful, continue
            req.body = result.data;
            next();
        }
        catch (error) {
            logger_1.logger.error(`Error in validation middleware: ${error instanceof Error ? error.message : String(error)}`);
            return res.status(500).json({
                success: false,
                error: 'Server error during validation'
            });
        }
    };
};
exports.validateRequest = validateRequest;
