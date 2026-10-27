export const JOURNAL_RULES = {
  mode: 'standard',
  width: 1200,
  height: 1600,
  maxItems: 4,
  maxNote: 300,
  layoutVersion: '2.0',
  renderVersion: '2.0',
} as const;
export const WEATHER = [
  { id: 'sunny', emoji: '☀️', label: '晴天', english: 'Sunny' },
  { id: 'partly_cloudy', emoji: '⛅', label: '多云', english: 'Cloudy' },
  { id: 'rainy', emoji: '🌧️', label: '下雨', english: 'Rainy' },
  { id: 'snowy', emoji: '❄️', label: '下雪', english: 'Snowy' },
  { id: 'windy', emoji: '🌬️', label: '有风', english: 'Windy' },
] as const;
export const MOODS = [
  { id: 'happy', emoji: '😊', label: '开心' },
  { id: 'relaxed', emoji: '😌', label: '松弛' },
  { id: 'loving', emoji: '🥰', label: '喜欢今天' },
  { id: 'sleepy', emoji: '😴', label: '有点困' },
  { id: 'tender', emoji: '🥺', label: '需要抱抱' },
] as const;
export type JournalState =
  | 'idle'
  | 'ready'
  | 'uploading'
  | 'recognizing'
  | 'composing'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'saving';
export type Box = [number, number, number, number];
export type RecognitionItem = {
  name: string;
  box: Box;
  category?: string | null;
  color?: string | null;
  material?: string | null;
  confidence?: number | null;
  visibility?: string | null;
};
export type Recognition = {
  items: RecognitionItem[];
  person?: { detected: boolean | null; visibility: string | null; box: Box | null };
};
export type Piece = {
  name: string;
  image: string;
  width?: number;
  height?: number;
  box?: Box;
  category?: string | null;
  confidence?: number | null;
  extraction?: 'region-crop' | 'manual';
};
export type Rect = { x: number; y: number; width: number; height: number };
export type JournalLayout = {
  version: string;
  variant: number;
  hero: Rect;
  pieces: Rect[];
  note: Rect;
  landscape: boolean;
};
export type Entry = {
  id: string;
  time: string;
  weather: string;
  mood: string;
  note: string;
  image: string;
  pieces: Piece[];
  recognized: boolean;
  schemaVersion?: 2;
  sourceImage?: string;
  sourceOriginal?: Blob;
  sourceName?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  weatherId?: string | null;
  moodId?: string | null;
  recognition?: Recognition | null;
  mode?: 'standard' | 'ai-paper';
  manualPieces?: Piece[];
  artwork?: string;
  artworkModel?: string;
  artworkVersion?: number;
  layout?: JournalLayout;
  layoutVersion?: string;
  renderVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'completed';
  noteOutsideImage?: boolean;
};
export type JournalDraft = {
  manualPieces?: Piece[];
  artwork?: string;
  artworkModel?: string;
  artworkVersion?: number;
  mode?: 'standard' | 'ai-paper';
  sourceImage: string;
  sourceOriginal?: Blob;
  sourceName: string;
  date: string;
  weatherId: string | null;
  moodId: string | null;
  note: string;
  editId: string | null;
  recognition: Recognition | null;
  updatedAt: string;
};
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function validateNote(note: string) {
  if (Array.from(note).length > JOURNAL_RULES.maxNote)
    throw new Error('个人记录最多300字，请缩短后生成。');
  if (
    Array.from(note).some(
      (char) => char.charCodeAt(0) < 32 && char !== '\n' && char !== '\r' && char !== '\t',
    )
  )
    throw new Error('个人记录包含不支持的控制字符。');
  return note;
}
export function selectPieces(items: RecognitionItem[]) {
  return items
    .filter(
      (item) =>
        item.visibility !== 'occluded' && (item.confidence == null || item.confidence >= 0.5),
    )
    .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
    .slice(0, JOURNAL_RULES.maxItems);
}
export function contain(rect: Rect, width: number, height: number): Rect {
  const scale = Math.min(rect.width / width, rect.height / height);
  return {
    x: rect.x + (rect.width - width * scale) / 2,
    y: rect.y + (rect.height - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}
export function journalLayout(
  width: number,
  height: number,
  pieces: Pick<Piece, 'width' | 'height'>[],
  variant = 0,
): JournalLayout {
  if (!(width > 0 && height > 0)) throw new Error('照片尺寸无效');
  const count = Math.min(pieces.length, JOURNAL_RULES.maxItems);
  const landscape = width / height > 1.12;
  const hero = contain(
    landscape
      ? { x: 90, y: 330, width: 1020, height: 650 }
      : count
        ? { x: 300, y: 320, width: 600, height: 970 }
        : { x: 140, y: 310, width: 920, height: 1030 },
    width,
    height,
  );
  // Small composition variations preserve the full photo and safe item columns.
  hero.x += ((variant % 3) - 1) * 8;
  hero.y += (variant % 2) * 8;
  const slots: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const piece = pieces[i]!;
    const index = variant % 2 ? count - 1 - i : i;
    const box = landscape
      ? {
          x: 90 + index * (1020 / count),
          y: 1060 + (index % 2) * 18,
          width: 1020 / count - 30,
          height: 235,
        }
      : {
          x: index % 2 ? 945 : 65,
          y: 420 + Math.floor(index / 2) * 430 + (variant % 3) * 12,
          width: 190,
          height: 280,
        };
    slots.push(contain(box, piece.width || 3, piece.height || 4));
  }
  return {
    version: JOURNAL_RULES.layoutVersion,
    variant,
    hero,
    pieces: slots,
    note: { x: 100, y: 1400, width: 1000, height: 130 },
    landscape,
  };
}
