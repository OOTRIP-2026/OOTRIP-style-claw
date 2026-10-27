import { expect, it } from 'vitest';
import {
  journalLayout,
  selectPieces,
  validateNote,
  validDate,
  type Rect,
} from '../../tools/lucy-demo/web/journal-model.js';
import { parseJournalItems } from '../../tools/lucy-demo/journal-server.js';
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
it('keeps the complete photo proportional and item rectangles outside it for portrait and landscape inputs', () => {
  for (const [w, h] of [
    [600, 1000],
    [1200, 700],
    [900, 900],
  ])
    for (const count of [0, 1, 2, 4])
      for (const variant of [0, 1, 2]) {
        const layout = journalLayout(
          w!,
          h!,
          Array.from({ length: count }, () => ({ width: 240, height: 320 })),
          variant,
        );
        expect(layout.hero.width / layout.hero.height).toBeCloseTo(w! / h!);
        for (const rect of layout.pieces) {
          expect(overlaps(rect, layout.hero)).toBe(false);
          expect(overlaps(rect, layout.note)).toBe(false);
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(1200);
          expect(rect.y + rect.height).toBeLessThan(1600);
        }
      }
});
it('retains exact user text, rejects overflow and invalid calendar dates', () => {
  const text = '今天很开心 😊\nA little memory.';
  expect(validateNote(text)).toBe(text);
  expect(validateNote('')).toBe('');
  expect(() => validateNote('字'.repeat(301))).toThrow();
  expect(validDate('2026-02-30')).toBe(false);
  expect(validDate('2026-10-26')).toBe(true);
  expect(validDate('2026-10-26T12:00')).toBe(false);
});
it('filters unreliable or occluded pieces and caps real crops at four', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    name: String(i),
    box: [0, 0, 500, 500] as [number, number, number, number],
    confidence: i / 10,
  }));
  expect(selectPieces(items)).toHaveLength(3);
  expect(selectPieces([...items, { ...items[7]!, visibility: 'occluded' }])).toHaveLength(3);
  expect(selectPieces(items.map((v) => ({ ...v, confidence: 1 })))).toHaveLength(4);
});
it('preserves unknown attributes as null and refuses malformed confidence', () => {
  const item = { name: '上衣', box: [0, 0, 500, 500], material: null, confidence: 0.8 };
  expect(parseJournalItems({ items: [item] })[0]).toEqual(item);
  expect(() => parseJournalItems({ items: [{ ...item, confidence: 2 }] })).toThrow();
});
