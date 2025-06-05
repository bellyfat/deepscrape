"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var winston_1 = require("winston");
// Configure logging levels
var levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Configure log level based on environment
var level = function () {
    var env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};
// Define log format
var format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
// Define transport options
var transports = [
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(function (info) { return "".concat(info.timestamp, " ").concat(info.level, ": ").concat(info.message, " ").concat(info.meta ? JSON.stringify(info.meta) : ''); })),
    }),
    new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
];
// Create the logger
var logger = winston_1.default.createLogger({
    level: level(),
    levels: levels,
    format: format,
    transports: transports,
});
exports.logger = logger;
