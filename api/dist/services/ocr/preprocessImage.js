"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessImage = void 0;
const sharp_1 = __importDefault(require("sharp"));
const CANDIDATE_ANGLES = [-2, -1, 0, 1, 2];
const scoreBuffer = async (buffer) => {
    const { data, info } = await (0, sharp_1.default)(buffer)
        .greyscale()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    let variance = 0;
    for (let y = 0; y < height; y += 1) {
        let rowSum = 0;
        for (let x = 0; x < width; x += 1) {
            rowSum += data[y * width + x];
        }
        const avg = rowSum / width;
        variance += (avg - 128) * (avg - 128);
    }
    return variance / height;
};
const deskew = async (buffer) => {
    const metadata = await (0, sharp_1.default)(buffer).metadata();
    let bestBuffer = buffer;
    let bestScore = -Infinity;
    for (const angle of CANDIDATE_ANGLES) {
        const rotated = await (0, sharp_1.default)(buffer)
            .rotate(angle, { background: '#ffffff' })
            .resize(metadata.width, metadata.height, { fit: 'cover' })
            .toBuffer();
        const score = await scoreBuffer(rotated);
        if (score > bestScore) {
            bestScore = score;
            bestBuffer = rotated;
        }
    }
    return bestBuffer;
};
const preprocessImage = async (buffer) => {
    const deskewed = await deskew(buffer);
    return (0, sharp_1.default)(deskewed)
        .greyscale()
        .median(1)
        .sharpen({ sigma: 1 })
        .modulate({ brightness: 1.05, saturation: 0.5 })
        .linear(1.1, -10)
        .normalize()
        .threshold(180)
        .toBuffer();
};
exports.preprocessImage = preprocessImage;
