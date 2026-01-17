import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { preprocessImage } from '../preprocessImage';

const createSampleImage = async (): Promise<Buffer> => {
  return sharp({
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

describe('preprocessImage', () => {
  it('keeps image dimensions after preprocessing', async () => {
    const input = await createSampleImage();
    const processed = await preprocessImage(input);
    const originalMeta = await sharp(input).metadata();
    const processedMeta = await sharp(processed).metadata();

    expect(processedMeta.width).toBe(originalMeta.width);
    expect(processedMeta.height).toBe(originalMeta.height);
  });
});

