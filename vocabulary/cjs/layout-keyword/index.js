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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPartialCompObject = exports.isResponsive = exports.isReadWrite = exports.isChildren = exports.isComponentName = exports.validateLayoutKeyword = void 0;
const validate_1 = __importDefault(require("./validate"));
__exportStar(require("./types"), exports);
exports.validateLayoutKeyword = validate_1.default;
function isComponentName(layoutKeyword) {
    return typeof layoutKeyword === 'string';
}
exports.isComponentName = isComponentName;
function isChildren(layoutKeyword) {
    return Array.isArray(layoutKeyword);
}
exports.isChildren = isChildren;
function isReadWrite(layoutKeyword) {
    return typeof layoutKeyword === 'object' && (!!layoutKeyword.read || !!layoutKeyword.write);
}
exports.isReadWrite = isReadWrite;
function isResponsive(layoutKeyword) {
    return typeof layoutKeyword === 'object' && (!!layoutKeyword.xs ||
        !!layoutKeyword.sm ||
        !!layoutKeyword.md ||
        !!layoutKeyword.lg ||
        !!layoutKeyword.wl);
}
exports.isResponsive = isResponsive;
function isPartialCompObject(layoutKeyword) {
    return typeof layoutKeyword === 'object' && !isReadWrite(layoutKeyword) && !isResponsive(layoutKeyword);
}
exports.isPartialCompObject = isPartialCompObject;
