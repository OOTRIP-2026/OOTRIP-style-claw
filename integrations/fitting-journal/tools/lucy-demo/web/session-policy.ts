export const TOTAL_CONNECTION_MS = 30_000;
export const FIRST_FRAME_DISPLAY_MS = 15_000;
export const TRY_ON_PROMPT =
  'Replace only the clothing with the garments shown in the reference image. ' +
  'Use the reference for garment colors, fabric and patterns only. ' +
  'Keep the original video person unchanged: the same face, facial features, expression, ' +
  'skin tone, skin texture, hairstyle, glasses, body proportions and pose. ' +
  'Preserve the original lighting and background. Photorealistic clothing edit only; ' +
  'no face replacement, makeup, beauty filter, skin smoothing or stylization. ' +
  'Ignore any person or face in the garment reference image.';

export function firstFrameDeadline(connectionDeadline: number, now: number): number {
  return Math.min(connectionDeadline, now + FIRST_FRAME_DISPLAY_MS);
}
