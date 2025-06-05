"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var crawler_1 = require("./crawler");
var auth_1 = require("../middleware/auth");
var router = (0, express_1.Router)();
// Web crawler endpoints
router.post('/web-crawler', auth_1.validateApiKey, crawler_1.webCrawlerController);
router.get('/web-crawler/:crawlId', auth_1.validateApiKey, crawler_1.webCrawlerStatusController);
router.post('/web-crawler/:crawlId/cancel', auth_1.validateApiKey, crawler_1.webCrawlerCancelController);
exports.default = router;
