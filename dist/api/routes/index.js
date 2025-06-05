"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crawler_1 = require("./crawler");
const auth_1 = require("../middleware/auth");
// Import other route handlers here
const router = (0, express_1.Router)();
// Existing routes
// router.get('/some-route', someHandler);
// ...
// Web crawler routes
router.post('/web-crawler', auth_1.validateApiKey, crawler_1.webCrawlerController);
router.get('/web-crawler/:crawlId', auth_1.validateApiKey, crawler_1.webCrawlerStatusController);
router.post('/web-crawler/:crawlId/cancel', auth_1.validateApiKey, crawler_1.webCrawlerCancelController);
exports.default = router;
