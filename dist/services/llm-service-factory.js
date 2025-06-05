"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMServiceFactory = exports.TaskComplexity = void 0;
const azure_openai_service_1 = require("./azure-openai.service");
const logger_1 = require("../utils/logger");
/**
 * Task complexity types (kept for API compatibility)
 */
var TaskComplexity;
(function (TaskComplexity) {
    TaskComplexity["LOW"] = "low";
    TaskComplexity["MEDIUM"] = "medium";
    TaskComplexity["HIGH"] = "high";
})(TaskComplexity || (exports.TaskComplexity = TaskComplexity = {}));
/**
 * Simplified factory class for creating LLM services
 * Always uses GPT-4o regardless of task complexity
 */
class LLMServiceFactory {
    /**
     * Create an Azure OpenAI service instance using the GPT-4o model
     * Ignores task complexity and always uses the same model
     */
    static createAzureOpenAIService(taskComplexity) {
        try {
            // Get configuration
            const apiKey = process.env.AZURE_OPENAI_API_KEY;
            const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'; // Default to latest API version
            const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o'; // Default to gpt-4o
            if (!apiKey || !endpoint) {
                const missingVars = [];
                if (!apiKey)
                    missingVars.push('AZURE_OPENAI_API_KEY');
                if (!endpoint)
                    missingVars.push('AZURE_OPENAI_ENDPOINT');
                logger_1.logger.warn(`Azure OpenAI service not configured correctly. Missing environment variables: ${missingVars.join(', ')}. ` +
                    'Make sure to set these variables in your .env file.');
                return null;
            }
            logger_1.logger.info(`Creating Azure OpenAI service with deployment: ${deploymentName}, API version: ${apiVersion}`);
            return new azure_openai_service_1.AzureOpenAIService({
                apiKey,
                endpoint,
                apiVersion,
                deploymentName
            });
        }
        catch (error) {
            logger_1.logger.error(`Error creating Azure OpenAI service: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    /**
     * Determine the task complexity (kept for API compatibility)
     * This is ignored in model selection but maintained for interface compatibility
     */
    static getTaskComplexityForExtraction(options) {
        // Always return MEDIUM complexity as it doesn't matter anymore
        return TaskComplexity.MEDIUM;
    }
}
exports.LLMServiceFactory = LLMServiceFactory;
