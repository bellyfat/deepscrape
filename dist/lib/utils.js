"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.initializeDirectories = initializeDirectories;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath Directory path to ensure exists
 * @returns boolean indicating success
 */
function ensureDirectoryExists(dirPath) {
    try {
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
        return true;
    }
    catch (error) {
        console.error(`Error creating directory ${dirPath}:`, error);
        return false;
    }
}
/**
 * Initializes application directories (logs, temp, etc.)
 */
function initializeDirectories() {
    // Create logs directory
    ensureDirectoryExists(path_1.default.join(process.cwd(), 'logs'));
}
