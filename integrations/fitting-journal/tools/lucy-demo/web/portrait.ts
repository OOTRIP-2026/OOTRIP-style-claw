export const TRANSPORT_WIDTH = 1280;
export const TRANSPORT_HEIGHT = 720;
export function portraitCrop(width: number, height: number) {
  if (!(width > 0 && height > 0)) throw new Error('视频尺寸尚未就绪');
  const cropWidth = Math.min(width, (height * 9) / 16);
  const cropHeight = (cropWidth * 16) / 9;
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
export function portraitRegion(width: number, height: number) {
  // The transport canvas contains a centered 9:16 image in a 16:9 frame.
  return {
    x: (width * (1 - 9 / 16 / (16 / 9))) / 2,
    y: 0,
    width: (width * (9 / 16)) / (16 / 9),
    height,
  };
}
export function fitRegion(
  region: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  const scale = Math.min(viewWidth / region.width, viewHeight / region.height);
  return {
    width: frameWidth * scale,
    height: frameHeight * scale,
    left: (viewWidth - region.width * scale) / 2 - region.x * scale,
    top: (viewHeight - region.height * scale) / 2 - region.y * scale,
  };
}
