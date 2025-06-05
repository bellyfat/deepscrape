"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crawler_controller_1 = require("../controllers/crawler.controller");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/v1/crawl
 * @desc    Initiate a new web crawl
 * @access  Public
 */
router.post('/', crawler_controller_1.crawl);
/**
 * @route   GET /api/v1/crawl/:jobId
 * @desc    Get status of a crawl job
 * @access  Public
 */
router.get('/:jobId', crawler_controller_1.getCrawlStatus);
/**
 * @route   DELETE /api/v1/crawl/:jobId
 * @desc    Cancel a running crawl job
 * @access  Public
 */
router.delete('/:jobId', crawler_controller_1.cancelCrawlJob);
exports.default = router;
