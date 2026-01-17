"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const canvas_1 = require("@napi-rs/canvas");
const globalScope = globalThis;
if (!globalScope.DOMMatrix) {
    globalScope.DOMMatrix = canvas_1.DOMMatrix;
}
if (!globalScope.Path2D) {
    globalScope.Path2D = canvas_1.Path2D;
}
if (!globalScope.ImageData) {
    globalScope.ImageData = canvas_1.ImageData;
}
