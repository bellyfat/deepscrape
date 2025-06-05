"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentCleaner = void 0;
const cheerio = __importStar(require("cheerio"));
const logger_1 = require("../utils/logger");
class ContentCleaner {
    /**
     * Clean HTML content by removing ads, tracking scripts, etc.
     */
    clean(scraperResponse) {
        try {
            logger_1.logger.info(`Cleaning HTML content for URL: ${scraperResponse.url}`);
            if (scraperResponse.contentType !== 'html' || !scraperResponse.content) {
                logger_1.logger.warn('Content is not HTML or is empty, skipping cleaning');
                return scraperResponse;
            }
            // Load HTML with cheerio
            const $ = cheerio.load(scraperResponse.content);
            // Find all heading elements for potential section identification
            const headings = $('h1, h2, h3, h4, h5, h6').toArray();
            logger_1.logger.info(`Found ${headings.length} headings in the document`);
            // Try to find main content first
            const mainContentSelectors = [
                'main',
                'article',
                '#main-content',
                '.main-content',
                '.article-content',
                '.post-content',
                '.entry-content',
                '[role="main"]',
                '#content',
                '.content',
                '.post',
                '.article',
                '.entry',
                // Add more generic selectors that might contain the whole document body
                '.doc',
                '.document',
                '.documentation',
                '#document-content',
                '.page-content',
                '.body-content',
                'body',
                '.body'
            ];
            let mainContent = null;
            // Try to find main content using selectors
            for (const selector of mainContentSelectors) {
                const element = $(selector);
                // Check if the element exists and contains substantial content
                if (element.length && element.text().trim().length > 300) {
                    // Check if it contains headings - prioritize content with headings
                    const foundHeadings = element.find('h1, h2, h3, h4, h5, h6').length;
                    if (foundHeadings > 0) {
                        mainContent = element;
                        logger_1.logger.info(`Found main content using selector: ${selector} with ${foundHeadings} headings`);
                        break;
                    }
                    else if (!mainContent && element.text().trim().length > 500) {
                        // Keep as a candidate if it has substantial text
                        mainContent = element;
                        logger_1.logger.info(`Found potential main content using selector: ${selector} (no headings)`);
                    }
                }
            }
            // If no main content found or no headings in main content, try fallback to largest text block
            if (!mainContent || mainContent.find('h1, h2, h3, h4, h5, h6').length === 0) {
                logger_1.logger.info('No main content with headings found, using text density analysis');
                // Find divs/sections with substantial text
                const textBlocks = [];
                $('div, section, article').each((_, element) => {
                    const text = $(element).text().trim();
                    const headingCount = $(element).find('h1, h2, h3, h4, h5, h6').length;
                    // Score based on text length and presence of headings
                    const score = text.length + (headingCount * 1000); // Prioritize blocks with headings
                    if (text.length > 300 || headingCount > 0) {
                        textBlocks.push({ element, textLength: score });
                    }
                });
                // Sort by score (descending)
                textBlocks.sort((a, b) => b.textLength - a.textLength);
                // Use the largest text block if available
                if (textBlocks.length > 0) {
                    mainContent = $(textBlocks[0].element);
                    const headingCount = mainContent.find('h1, h2, h3, h4, h5, h6').length;
                    logger_1.logger.info(`Using largest text block with score ${textBlocks[0].textLength} and ${headingCount} headings`);
                }
            }
            // If still no good content found or no headings, try to construct a content wrapper with all headings and their content
            if (!mainContent || mainContent.find('h1, h2, h3, h4, h5, h6').length === 0) {
                logger_1.logger.info('Creating artificial main content container with all heading sections');
                // Create a new container for our constructed content
                const contentContainer = $('<div class="constructed-content"></div>');
                // Find all top-level headings
                const topHeadings = $('h1, h2').toArray();
                if (topHeadings.length > 0) {
                    logger_1.logger.info(`Found ${topHeadings.length} top-level headings to extract content from`);
                    // For each heading, add it and all content until the next heading
                    for (let i = 0; i < topHeadings.length; i++) {
                        const heading = $(topHeadings[i]);
                        const nextHeading = i < topHeadings.length - 1 ? $(topHeadings[i + 1]) : null;
                        // Add the heading
                        contentContainer.append(heading.clone());
                        // Get all elements between this heading and the next
                        if (nextHeading) {
                            let current = heading[0].nextSibling;
                            while (current && current !== nextHeading[0]) {
                                if (current.nodeType === 1) { // Element node
                                    contentContainer.append($(current).clone());
                                }
                                current = current.nextSibling;
                            }
                        }
                        else {
                            // For the last heading, get all following siblings until a new section or the end
                            let current = heading[0].nextSibling;
                            while (current) {
                                if (current.nodeType === 1) { // Element node
                                    // Stop if we find another heading of the same level or higher
                                    const nodeName = current.tagName?.toLowerCase();
                                    if (nodeName && nodeName.match(/^h[1-2]$/)) {
                                        break;
                                    }
                                    contentContainer.append($(current).clone());
                                }
                                current = current.nextSibling;
                            }
                        }
                    }
                    mainContent = contentContainer;
                }
            }
            // Remove common ads and tracking elements
            this.removeAdsAndTracking($);
            // Remove unnecessary attributes
            this.removeAttributes($);
            // Remove hidden elements
            this.removeHiddenElements($);
            // If main content was found, use it
            let cleanedHtml = '';
            if (mainContent) {
                // Clone the main content and wrap it in a div to preserve structure
                const $mainContentWrapper = $('<div class="main-content-wrapper"></div>');
                $mainContentWrapper.append(mainContent.clone());
                const mainContentHtml = $mainContentWrapper.html();
                cleanedHtml = mainContentHtml || '';
                // Count headings in the final content
                const $finalCheck = cheerio.load(cleanedHtml);
                const finalHeadings = $finalCheck('h1, h2, h3, h4, h5, h6').length;
                logger_1.logger.info(`Final cleaned HTML contains ${finalHeadings} headings`);
            }
            else {
                // Get the cleaned HTML of the entire document
                cleanedHtml = $.html();
                logger_1.logger.info('No main content found, using entire cleaned document');
            }
            // Return new response with cleaned content
            const result = {
                ...scraperResponse,
                content: cleanedHtml
            };
            logger_1.logger.info('HTML content cleaning complete');
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error cleaning HTML content: ${error instanceof Error ? error.message : String(error)}`);
            // Return original response with error
            return {
                ...scraperResponse,
                error: `Content cleaning error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Remove common ads, tracking scripts, and unwanted elements
     */
    removeAdsAndTracking($) {
        // Remove scripts
        $('script').remove();
        // Remove style tags
        $('style').remove();
        // Remove common ad containers
        $('[id*="google_ad"], [id*="banner"], [id*="advertisement"], [class*="ad-"], [class*="ads-"], [class*="banner"]').remove();
        // Remove tracking pixels and iframes
        $('iframe[src*="doubleclick"], iframe[src*="googlead"], iframe[src*="facebook"], img[src*="pixel"]').remove();
        // Remove social sharing buttons
        $('[class*="share"], [class*="social"], [class*="twitter"], [class*="facebook"]').remove();
        // Remove comments sections (common patterns)
        $('#comments, .comments, .comment-section, .disqus, #disqus_thread').remove();
        // Remove newsletter signups, popups
        $('[class*="newsletter"], [class*="popup"], [class*="modal"], [id*="modal"], [id*="popup"]').remove();
        // Remove navigation elements (optional, may want to keep these)
        // $('nav, .nav, .navigation, .menu, header, footer').remove();
    }
    /**
     * Remove unnecessary attributes to clean up the HTML
     */
    removeAttributes($) {
        // List of attributes to remove
        const attributesToRemove = [
            'onclick', 'onmouseover', 'onmouseout', 'onload', 'onerror',
            'data-track', 'data-tracking', 'data-analytics', 'data-ga',
            'style', 'class', 'id', // Sometimes you may want to keep these for structure
            'tabindex', 'role', 'aria-*', // Accessibility attributes
        ];
        // For now, only remove event handlers and tracking attributes
        $('*').each((_i, el) => {
            for (const attr of Object.keys(el.attribs || {})) {
                if (attr.startsWith('on') || attr.includes('track') || attr.includes('analytics')) {
                    $(el).removeAttr(attr);
                }
            }
        });
    }
    /**
     * Remove hidden elements that are not visible to the user
     */
    removeHiddenElements($) {
        // Remove elements with inline styles hiding them
        $('[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [style*="visibility:hidden"]').remove();
        // Remove common hidden element classes
        $('.hidden, .hide, .invisible, .visually-hidden, .sr-only').remove();
    }
}
exports.ContentCleaner = ContentCleaner;
