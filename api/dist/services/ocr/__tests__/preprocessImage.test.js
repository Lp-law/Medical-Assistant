"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sharp_1 = __importDefault(require("sharp"));
const preprocessImage_1 = require("../preprocessImage");
const createSampleImage = async () => {
    return (0, sharp_1.default)({
        create: {
            width: 120,
            height: 80,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    })
        .png()
        .toBuffer();
};
(0, vitest_1.describe)('preprocessImage', () => {
    (0, vitest_1.it)('keeps image dimensions after preprocessing', async () => {
        const input = await createSampleImage();
        const processed = await (0, preprocessImage_1.preprocessImage)(input);
        const originalMeta = await (0, sharp_1.default)(input).metadata();
        const processedMeta = await (0, sharp_1.default)(processed).metadata();
        (0, vitest_1.expect)(processedMeta.width).toBe(originalMeta.width);
        (0, vitest_1.expect)(processedMeta.height).toBe(originalMeta.height);
    });
});
