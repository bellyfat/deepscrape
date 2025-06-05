"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAIService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class AzureOpenAIService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Get completion from Azure OpenAI
     */
    async getCompletion(messages, options = {}, responseFormat) {
        try {
            const { endpoint, apiKey, apiVersion, deploymentName } = this.config;
            const { temperature = 0.2, maxTokens = 4000 } = options;
            const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
            const headers = {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            };
            const payload = {
                messages,
                temperature,
                max_tokens: maxTokens,
                n: 1,
            };
            // If responseFormat is provided, add it to the payload
            if (responseFormat) {
                payload.response_format = responseFormat;
            }
            logger_1.logger.info(`Sending request to Azure OpenAI: ${deploymentName}`);
            const response = await axios_1.default.post(url, payload, { headers });
            if (response.data.error) {
                logger_1.logger.error(`Azure OpenAI error: ${JSON.stringify(response.data.error)}`);
                return {
                    success: false,
                    error: response.data.error.message || 'Unknown Azure OpenAI error'
                };
            }
            // Process the response
            const content = response.data.choices[0].message.content;
            try {
                // If response is JSON string, parse it
                const parsedContent = typeof content === 'string' && content.trim().startsWith('{')
                    ? JSON.parse(content)
                    : content;
                return {
                    success: true,
                    data: parsedContent
                };
            }
            catch (parseError) {
                // If parsing fails, return the raw content
                return {
                    success: true,
                    data: content
                };
            }
        }
        catch (error) {
            logger_1.logger.error(`Error calling Azure OpenAI: ${error instanceof Error ? error.message : String(error)}`);
            return {
                success: false,
                error: `Azure OpenAI service error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Get embeddings from Azure OpenAI
     */
    async getEmbeddings(text) {
        try {
            const { endpoint, apiKey, apiVersion, deploymentName } = this.config;
            const url = `${endpoint}/openai/deployments/${deploymentName}/embeddings?api-version=${apiVersion}`;
            const headers = {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            };
            const payload = {
                input: Array.isArray(text) ? text : [text],
                model: deploymentName
            };
            logger_1.logger.info(`Getting embeddings from Azure OpenAI: ${deploymentName}`);
            const response = await axios_1.default.post(url, payload, { headers });
            if (response.data.error) {
                logger_1.logger.error(`Azure OpenAI embeddings error: ${JSON.stringify(response.data.error)}`);
                return {
                    success: false,
                    error: response.data.error.message || 'Unknown Azure OpenAI error'
                };
            }
            const embeddings = response.data.data.map((item) => item.embedding);
            return {
                success: true,
                data: embeddings
            };
        }
        catch (error) {
            logger_1.logger.error(`Error getting embeddings: ${error instanceof Error ? error.message : String(error)}`);
            return {
                success: false,
                error: `Azure OpenAI embeddings error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}
exports.AzureOpenAIService = AzureOpenAIService;
