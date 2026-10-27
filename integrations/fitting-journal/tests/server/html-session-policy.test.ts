import { expect, it } from 'vitest';
import { firstFrameDeadline } from '../../tools/lucy-demo/web/session-policy.js';
it('allows fifteen seconds after first frame while retaining the total connection deadline', () => {
  expect(firstFrameDeadline(30_000, 6_000)).toBe(21_000);
  expect(firstFrameDeadline(30_000, 24_000)).toBe(30_000);
  expect(firstFrameDeadline(30_000, 31_000)).toBe(30_000);
});
