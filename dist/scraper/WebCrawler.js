"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebCrawler = void 0;
var axios_1 = require("axios");
var cheerio_1 = require("cheerio");
var url_1 = require("url");
var robots_parser_1 = require("robots-parser");
var https_1 = require("https");
var logger_1 = require("../lib/logger");
var WebCrawler = /** @class */ (function () {
    function WebCrawler(_a) {
        var crawlId = _a.crawlId, initialUrl = _a.initialUrl, baseUrl = _a.baseUrl, _b = _a.includePaths, includePaths = _b === void 0 ? [] : _b, _c = _a.excludePaths, excludePaths = _c === void 0 ? [] : _c, _d = _a.maxCrawledLinks, maxCrawledLinks = _d === void 0 ? 10000 : _d, _e = _a.limit, limit = _e === void 0 ? 100 : _e, _f = _a.maxDepth, maxDepth = _f === void 0 ? 5 : _f, _g = _a.allowSubdomains, allowSubdomains = _g === void 0 ? false : _g, _h = _a.ignoreRobotsTxt, ignoreRobotsTxt = _h === void 0 ? false : _h, _j = _a.allowExternalLinks, allowExternalLinks = _j === void 0 ? false : _j, _k = _a.regexOnFullURL, regexOnFullURL = _k === void 0 ? false : _k;
        this.visited = new Set();
        this.crawledUrls = new Map();
        this.sitemapsHit = new Set();
        this.crawlId = crawlId;
        this.initialUrl = initialUrl;
        this.baseUrl = baseUrl !== null && baseUrl !== void 0 ? baseUrl : new url_1.URL(initialUrl).origin;
        this.includePaths = Array.isArray(includePaths) ? includePaths : [];
        this.excludePaths = Array.isArray(excludePaths) ? excludePaths : [];
        this.limit = limit;
        this.maxCrawledLinks = maxCrawledLinks !== null && maxCrawledLinks !== void 0 ? maxCrawledLinks : limit;
        this.maxDepth = maxDepth !== null && maxDepth !== void 0 ? maxDepth : 5;
        this.robotsTxtUrl = "".concat(this.baseUrl).concat(this.baseUrl.endsWith('/') ? '' : '/', "robots.txt");
        this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, '');
        this.allowSubdomains = allowSubdomains !== null && allowSubdomains !== void 0 ? allowSubdomains : false;
        this.ignoreRobotsTxt = ignoreRobotsTxt !== null && ignoreRobotsTxt !== void 0 ? ignoreRobotsTxt : false;
        this.allowExternalLinks = allowExternalLinks !== null && allowExternalLinks !== void 0 ? allowExternalLinks : false;
        this.regexOnFullURL = regexOnFullURL !== null && regexOnFullURL !== void 0 ? regexOnFullURL : false;
        this.logger = logger_1.logger.child({ crawlId: this.crawlId, module: 'WebCrawler' });
    }
    // Get URL depth
    WebCrawler.prototype.getURLDepth = function (url) {
        try {
            var parsedUrl = new url_1.URL(url);
            // Count path segments
            return parsedUrl.pathname.split('/').filter(Boolean).length;
        }
        catch (error) {
            return 0;
        }
    };
    // Filter links based on crawler configuration
    WebCrawler.prototype.filterLinks = function (links, limit) {
        var _this = this;
        return links
            .filter(function (link) {
            var _a, _b, _c;
            var url;
            try {
                url = new url_1.URL(link.trim(), _this.baseUrl);
            }
            catch (error) {
                _this.logger.debug("Error processing link: ".concat(link), {
                    error: error,
                    method: 'filterLinks',
                });
                return false;
            }
            var path = url.pathname;
            var depth = _this.getURLDepth(url.toString());
            // Check if the link exceeds the maximum depth allowed
            if (depth > _this.maxDepth) {
                return false;
            }
            var filterPath = _this.regexOnFullURL ? link : path;
            // Check if the link should be excluded
            if (_this.excludePaths.length > 0 && _this.excludePaths[0] !== '') {
                if (_this.excludePaths.some(function (excludePattern) {
                    return new RegExp(excludePattern).test(filterPath);
                })) {
                    return false;
                }
            }
            // Check if the link matches the include patterns, if any are specified
            if (_this.includePaths.length > 0 && _this.includePaths[0] !== '') {
                if (!_this.includePaths.some(function (includePattern) {
                    return new RegExp(includePattern).test(filterPath);
                })) {
                    return false;
                }
            }
            // Check domain matching
            var initialHostname = new url_1.URL(_this.initialUrl).hostname.replace(/^www\./, '');
            var linkHostname = url.hostname.replace(/^www\./, '');
            // Check if subdomains are allowed
            if (!_this.allowSubdomains && !_this.allowExternalLinks) {
                if (linkHostname !== initialHostname) {
                    return false;
                }
            }
            else if (_this.allowSubdomains && !_this.allowExternalLinks) {
                // Allow subdomains but not external domains
                if (!linkHostname.endsWith(initialHostname) && linkHostname !== initialHostname) {
                    return false;
                }
            }
            else if (!_this.allowExternalLinks) {
                // Don't allow any external links
                if (linkHostname !== initialHostname) {
                    return false;
                }
            }
            // Check if the link is allowed by robots.txt
            var isAllowed = _this.ignoreRobotsTxt
                ? true
                : ((_c = (_b = (_a = _this.robots).isAllowed) === null || _b === void 0 ? void 0 : _b.call(_a, link, 'XeroxScraperBot')) !== null && _c !== void 0 ? _c : true);
            if (!isAllowed) {
                _this.logger.debug("Link disallowed by robots.txt: ".concat(link));
                return false;
            }
            // Filter out common file extensions
            if (_this.isFile(link)) {
                return false;
            }
            return true;
        })
            .slice(0, limit);
    };
    // Check if URL points to a file (not HTML)
    WebCrawler.prototype.isFile = function (url) {
        try {
            var parsed = new url_1.URL(url);
            var path_1 = parsed.pathname.toLowerCase();
            var fileExtensions = [
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.zip', '.rar', '.tar', '.gz', '.7z',
                '.mp3', '.mp4', '.avi', '.mov', '.wmv',
                '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
                '.css', '.js', '.xml', '.json', '.csv'
            ];
            return fileExtensions.some(function (ext) { return path_1.endsWith(ext); });
        }
        catch (e) {
            return false;
        }
    };
    // Get robots.txt content
    WebCrawler.prototype.getRobotsTxt = function () {
        return __awaiter(this, arguments, void 0, function (skipTlsVerification) {
            var extraArgs, response, error_1;
            if (skipTlsVerification === void 0) { skipTlsVerification = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        extraArgs = {};
                        if (skipTlsVerification) {
                            extraArgs = {
                                httpsAgent: new https_1.default.Agent({
                                    rejectUnauthorized: false,
                                })
                            };
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.get(this.robotsTxtUrl, __assign({ timeout: 5000 }, extraArgs))];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_1 = _a.sent();
                        this.logger.debug("Failed to get robots.txt from ".concat(this.robotsTxtUrl), { error: error_1 });
                        return [2 /*return*/, ''];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Import robots.txt content
    WebCrawler.prototype.importRobotsTxt = function (txt) {
        this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, txt);
    };
    // Try to find and process sitemap
    WebCrawler.prototype.trySitemap = function (baseUrl_1) {
        return __awaiter(this, arguments, void 0, function (baseUrl, skipTlsVerification) {
            var sitemapUrl, extraArgs, response, error_2;
            if (skipTlsVerification === void 0) { skipTlsVerification = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sitemapUrl = "".concat(baseUrl).concat(baseUrl.endsWith('/') ? '' : '/', "sitemap.xml");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        extraArgs = {};
                        if (skipTlsVerification) {
                            extraArgs = {
                                httpsAgent: new https_1.default.Agent({
                                    rejectUnauthorized: false,
                                })
                            };
                        }
                        return [4 /*yield*/, axios_1.default.get(sitemapUrl, __assign({ timeout: 10000 }, extraArgs))];
                    case 2:
                        response = _a.sent();
                        if (response.status === 200) {
                            return [2 /*return*/, this.extractLinksFromSitemap(response.data)];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        this.logger.debug("Failed to get sitemap from ".concat(sitemapUrl), { error: error_2 });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, []];
                }
            });
        });
    };
    // Extract links from sitemap XML
    WebCrawler.prototype.extractLinksFromSitemap = function (sitemapXml) {
        var _this = this;
        try {
            var $_1 = (0, cheerio_1.load)(sitemapXml, { xmlMode: true });
            var links_1 = [];
            // Process standard sitemap format
            $_1('url > loc').each(function (_, element) {
                var url = $_1(element).text().trim();
                if (url)
                    links_1.push(url);
            });
            // Process sitemap index
            $_1('sitemap > loc').each(function (_, element) {
                var url = $_1(element).text().trim();
                if (url)
                    _this.sitemapsHit.add(url);
            });
            return links_1;
        }
        catch (error) {
            this.logger.error('Error parsing sitemap', { error: error });
            return [];
        }
    };
    // Extract links from HTML content
    WebCrawler.prototype.extractLinksFromHTML = function (html, baseUrl) {
        try {
            var $_2 = (0, cheerio_1.load)(html);
            var links_2 = [];
            $_2('a[href]').each(function (_, element) {
                var _a;
                try {
                    var href = (_a = $_2(element).attr('href')) === null || _a === void 0 ? void 0 : _a.trim();
                    if (!href)
                        return;
                    // Skip anchor links and javascript
                    if (href.startsWith('#') || href.startsWith('javascript:'))
                        return;
                    // Resolve relative URLs
                    var fullUrl = new url_1.URL(href, baseUrl).href;
                    links_2.push(fullUrl);
                }
                catch (error) {
                    // Skip invalid URLs
                }
            });
            return links_2;
        }
        catch (error) {
            this.logger.error('Error extracting links from HTML', { error: error });
            return [];
        }
    };
    // Normalize URL for consistent comparison
    WebCrawler.prototype.normalizeURL = function (url) {
        try {
            var urlObj = new url_1.URL(url);
            // Remove query parameters if needed
            urlObj.search = '';
            // Remove hash
            urlObj.hash = '';
            // Ensure trailing slash consistency
            if (urlObj.pathname === '') {
                urlObj.pathname = '/';
            }
            return urlObj.href;
        }
        catch (error) {
            return url;
        }
    };
    // Generate URL permutations to handle common redirects
    WebCrawler.prototype.generateURLPermutations = function (url) {
        var urlObj = new url_1.URL(url);
        var permutations = [];
        // Handle www vs non-www
        var withWWW = new url_1.URL(urlObj.toString());
        var withoutWWW = new url_1.URL(urlObj.toString());
        if (urlObj.hostname.startsWith('www.')) {
            withoutWWW.hostname = withWWW.hostname.slice(4);
        }
        else {
            withWWW.hostname = 'www.' + withoutWWW.hostname;
        }
        permutations.push(withWWW, withoutWWW);
        // Handle HTTP vs HTTPS
        var urlsWithProtocols = permutations.flatMap(function (u) {
            var httpVersion = new url_1.URL(u.toString());
            var httpsVersion = new url_1.URL(u.toString());
            httpVersion.protocol = 'http:';
            httpsVersion.protocol = 'https:';
            return [httpVersion, httpsVersion];
        });
        // Handle index.html variations
        return urlsWithProtocols.flatMap(function (u) {
            var urlWithSlash = new url_1.URL(u.toString());
            var urlWithIndex = new url_1.URL(u.toString());
            var urlWithIndexPhp = new url_1.URL(u.toString());
            if (urlWithSlash.pathname.endsWith('/')) {
                urlWithIndex.pathname += 'index.html';
                urlWithIndexPhp.pathname += 'index.php';
            }
            else if (!urlWithSlash.pathname.endsWith('/')) {
                urlWithSlash.pathname += '/';
                urlWithIndex.pathname += '/index.html';
                urlWithIndexPhp.pathname += '/index.php';
            }
            return [u, urlWithSlash, urlWithIndex, urlWithIndexPhp];
        });
    };
    return WebCrawler;
}());
exports.WebCrawler = WebCrawler;
