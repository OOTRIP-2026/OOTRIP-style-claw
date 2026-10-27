import { expect, it } from 'vitest';
import {
  portraitCrop,
  portraitRegion,
  fitRegion,
  TRANSPORT_WIDTH,
  TRANSPORT_HEIGHT,
} from '../../tools/lucy-demo/web/portrait.js';
it('preserves equal horizontal and vertical scale when placing camera crops into transport', () => {
  const region = portraitRegion(TRANSPORT_WIDTH, TRANSPORT_HEIGHT);
  for (const [width, height] of [
    [1280, 720],
    [720, 1280],
    [640, 480],
    [1080, 1920],
  ]) {
    const crop = portraitCrop(width!, height!);
    expect(crop.width / crop.height).toBeCloseTo(9 / 16);
    expect(region.width / crop.width).toBeCloseTo(region.height / crop.height);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(width!);
    expect(crop.y + crop.height).toBeLessThanOrEqual(height!);
  }
});
it('fits decoded portrait with identical scale in expanded and collapsed mirrors', () => {
  const region = portraitRegion(1280, 720);
  for (const viewWidth of [290, 396]) {
    const fit = fitRegion(region, 1280, 720, viewWidth, 502);
    expect(fit.width / 1280).toBeCloseTo(fit.height / 720);
    const scale = fit.width / 1280;
    expect(fit.left + region.x * scale).toBeCloseTo((viewWidth - region.width * scale) / 2);
    expect(region.width * scale).toBeLessThanOrEqual(viewWidth);
    expect(region.height * scale).toBeLessThanOrEqual(502);
  }
});
