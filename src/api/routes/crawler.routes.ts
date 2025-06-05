import { Router } from 'express';
import { crawl, getCrawlStatus, cancelCrawlJob } from '../controllers/crawler.controller';

const router = Router();

/**
 * @route   POST /api/v1/crawl
 * @desc    Initiate a new web crawl
 * @access  Public
 */
router.post('/', crawl);

/**
 * @route   GET /api/v1/crawl/:jobId
 * @desc    Get status of a crawl job
 * @access  Public
 */
router.get('/:jobId', getCrawlStatus);

/**
 * @route   DELETE /api/v1/crawl/:jobId
 * @desc    Cancel a running crawl job
 * @access  Public
 */
router.delete('/:jobId', cancelCrawlJob);

export default router; 