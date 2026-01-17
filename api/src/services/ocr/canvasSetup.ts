import { DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas';

const globalScope = globalThis as unknown as Record<string, unknown>;

if (!globalScope.DOMMatrix) {
  globalScope.DOMMatrix = DOMMatrix;
}

if (!globalScope.Path2D) {
  globalScope.Path2D = Path2D;
}

if (!globalScope.ImageData) {
  globalScope.ImageData = ImageData;
}

