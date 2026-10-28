import { expect, it } from 'vitest';
import { firstFrameDeadline, TOTAL_CONNECTION_MS, FIRST_FRAME_DISPLAY_MS, CONNECTION_WAIT_MS } from '../../tools/lucy-demo/web/session-policy.js';
it('provides thirty seconds after first frame and keeps a sixty-second ceiling', () => {
 expect(CONNECTION_WAIT_MS).toBe(30000);
 expect(FIRST_FRAME_DISPLAY_MS).toBe(30000);
 expect(TOTAL_CONNECTION_MS).toBe(60000);
 expect(firstFrameDeadline(60000,6000)).toBe(36000);
 expect(firstFrameDeadline(60000,29000)).toBe(59000);
 expect(firstFrameDeadline(60000,45000)).toBe(60000);
});
