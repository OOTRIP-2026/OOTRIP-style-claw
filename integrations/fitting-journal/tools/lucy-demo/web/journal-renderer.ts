import { contain, journalLayout, type Entry, type Piece } from './journal-model.js';
export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('照片无法解码。'));
    image.src = source;
  });
}
async function composeArtworkLegacy(
  artwork: string,
  stamp: Pick<Entry, 'time' | 'weather' | 'mood' | 'note'>,
  variant = 0,
) {
  const image = await loadImage(artwork);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = '#f5f1e9';
  ctx.fillRect(0, 0, 1200, 1600);
  // Fit the entire result above the footer: even if AI ignores its reserved margin,
  // the user's face, clothes and feet cannot be hidden by our personal-text layer.
  const hero = contain({ x: 0, y: 0, width: 1200, height: 1344 }, image.width, image.height);
  ctx.drawImage(image, hero.x, hero.y, hero.width, hero.height);
  // The generation prompt reserves this footer. User data is never rewritten by AI.
  ctx.fillStyle = '#f5f1e9';
  ctx.fillRect(0, 1344, 1200, 256);
  ctx.fillStyle = '#536c77';
  ctx.font = '30px Georgia';
  ctx.fillText(stamp.time.replace(/-/g, ' / '), 70, 1395);
  ctx.font = '34px sans-serif';
  ctx.fillText([stamp.weather, stamp.mood].filter(Boolean).join('  '), 940, 1395);
  ctx.font = '25px sans-serif';
  ctx.fillStyle = '#5f5a50';
  const lines: string[] = [];
  for (const paragraph of stamp.note.split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > 1060) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  const noteOutsideImage = lines.length > 3;
  if (stamp.note && !noteOutsideImage)
    lines.forEach((line, index) => ctx.fillText(line, variant % 2 ? 90 : 70, 1445 + index * 31));
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#999083';
  ctx.fillText('OOTRIP · AI剪贴创作', 70, 1570);
  return {
    image: target.toDataURL('image/png'),
    noteOutsideImage,
    layout: {
      version: '3.0-ai',
      variant,
      hero,
      pieces: [],
      note: { x: 70, y: 1420, width: 1060, height: 110 },
      landscape: false,
    },
    sourceWidth: image.width,
    sourceHeight: image.height,
  };
}
// Keep earlier saved artwork compatible with its original reserved footer.
export async function composeArtwork(
  artwork: string,
  stamp: Pick<Entry, 'time' | 'weather' | 'mood' | 'note'>,
  variant = 0,
  integrated = true,
) {
  if (!integrated) return composeArtworkLegacy(artwork, stamp, variant);
  const image = await loadImage(artwork);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = '#f5f1e9';
  ctx.fillRect(0, 0, 1200, 1600);
  const hero = contain({ x: 0, y: 0, width: 1200, height: 1600 }, image.width, image.height);
  ctx.drawImage(image, hero.x, hero.y, hero.width, hero.height);
  const ink = artworkInk(ctx, target.width, target.height);
  const hand = '"KaiTi", "STKaiti", "Segoe Print", cursive';
  // These three quiet regions are also specified in the generation prompt.
  // Values stay local and exact, so editing them never requires another model call.
  const paper = (x: number, y: number, w: number, h: number, angle: number, draw: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = '#51473520';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fffaf0ed';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 3);
    ctx.lineTo(w / 2 - 4, -h / 2);
    ctx.lineTo(w / 2, h / 2 - 3);
    ctx.lineTo(-w / 2 + 3, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = ink;
    draw();
    ctx.restore();
  };
  paper(1020, 1295, 240, 75, variant % 2 ? 0.035 : -0.055, () => {
    ctx.font = 'italic 27px ' + hand;
    ctx.textAlign = 'center';
    ctx.fillText(stamp.time.replace(/-/g, ' / '), 0, 10, 220);
  });
  const emojis = [stamp.weather, stamp.mood].filter(Boolean);
  if (emojis.length)
    paper(1030, 295, 190, 100, 0.065, () => {
      ctx.textAlign = 'center';
      ctx.font = '43px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      emojis.forEach((emoji, index) => {
        ctx.save();
        ctx.translate((index - (emojis.length - 1) / 2) * 68, index % 2 ? 18 : 6);
        ctx.rotate(index % 2 ? 0.08 : -0.09);
        ctx.fillText(emoji, 0, 0);
        ctx.restore();
      });
    });
  let noteOutsideImage = false;
  if (stamp.note) {
    // Short notes look handwritten; long notes shrink only within a readable range.
    let fontSize = 27;
    let lines: string[] = [];
    const wrap = () => {
      ctx.font = fontSize + 'px ' + hand;
      const output: string[] = [];
      for (const paragraph of stamp.note.split('\n')) {
        let line = '';
        for (const char of Array.from(paragraph)) {
          if (ctx.measureText(line + char).width > 270 && line) {
            output.push(line);
            line = '';
          }
          line += char;
        }
        output.push(line);
      }
      return output;
    };
    do {
      lines = wrap();
      if (lines.length * fontSize * 1.35 <= 480 || fontSize <= 18) break;
      fontSize--;
    } while (true);
    noteOutsideImage = lines.length * fontSize * 1.35 > 480;
    if (!noteOutsideImage)
      paper(
        207,
        lines.length * fontSize * 1.35 > 225 ? 1055 : 1185,
        308,
        Math.max(100, lines.length * fontSize * 1.35 + 32),
        -0.035,
        () => {
          ctx.font = fontSize + 'px ' + hand;
          ctx.textAlign = 'left';
          lines.forEach((line, index) =>
            ctx.fillText(
              line,
              -134,
              (index - (lines.length - 1) / 2) * fontSize * 1.35 + fontSize / 3,
            ),
          );
        },
      );
  }
  ctx.font = '14px sans-serif';
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.65;
  ctx.fillText('OOTRIP · AI剪贴创作', 35, 1570);
  ctx.globalAlpha = 1;
  return {
    image: target.toDataURL('image/png'),
    noteOutsideImage,
    layout: {
      version: '4.0-ai',
      variant,
      hero,
      pieces: [],
      note: { x: 53, y: 1060, width: 308, height: 250 },
      landscape: false,
    },
    sourceWidth: image.width,
    sourceHeight: image.height,
  };
}
function artworkInk(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Derive a restrained dark ink from the generated artwork's actual palette.
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  for (let i = 0; i < pixels.length; i += 4 * 173) {
    const red = pixels[i]!,
      green = pixels[i + 1]!,
      blue = pixels[i + 2]!;
    const light = (red + green + blue) / 3;
    if (light > 55 && light < 210 && Math.max(red, green, blue) - Math.min(red, green, blue) > 15) {
      r += red;
      g += green;
      b += blue;
      count++;
    }
  }
  if (!count) return '#5b6359';
  return 'rgb(' + [r, g, b].map((v) => Math.round((v / count) * 0.48)).join(',') + ')';
}
export function canvas(width: number, height: number) {
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持画布。');
  return { target, ctx };
}
export async function compose(
  source: string,
  pieces: Piece[],
  stamp: Pick<Entry, 'time' | 'weather' | 'mood' | 'note'>,
  variant = 0,
) {
  const image = await loadImage(source);
  const layout = journalLayout(image.width, image.height, pieces, variant);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = '#f5f1e9';
  ctx.fillRect(0, 0, 1200, 1600);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff65' : '#8c806018';
    ctx.fillRect((i * 739) % 1200, (i * 431) % 1600, 1, 2);
  }
  ctx.fillStyle = '#59624f';
  ctx.font = '20px Georgia';
  ctx.fillText('O O T R I P   /   O U T F I T   D I A R Y', 85, 85);
  ctx.font = 'italic 62px "Segoe Print", Georgia, cursive';
  ctx.fillText(variant % 2 ? 'Wear the moment.' : 'A day to remember.', 85, 173);
  ctx.font = '26px sans-serif';
  ctx.fillText(stamp.time.replace(/-/g, ' / '), 88, 235);
  ctx.font = '35px sans-serif';
  ctx.fillText([stamp.weather, stamp.mood].filter(Boolean).join('  '), 880, 235);
  const frame = async (src: string, rect: typeof layout.hero) => {
    const img = await loadImage(src);
    ctx.save();
    ctx.shadowColor = '#65573b28';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(rect.x - 12, rect.y - 12, rect.width + 24, rect.height + 34);
    ctx.restore();
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  };
  await frame(source, layout.hero);
  ctx.fillStyle = '#c6b89b99';
  ctx.fillRect(layout.hero.x + layout.hero.width / 2 - 65, layout.hero.y - 28, 130, 36);
  for (let i = 0; i < layout.pieces.length; i++) {
    const piece = pieces[i]!;
    const rect = layout.pieces[i]!;
    await frame(piece.image, rect);
    ctx.fillStyle = '#696953';
    ctx.font = '18px sans-serif';
    ctx.fillText(piece.name, rect.x, rect.y + rect.height + 52, rect.width);
  }
  // Decorations remain outside the photo so they cannot cover a face or garment.
  ctx.fillStyle = '#898773';
  ctx.font = '38px Georgia';
  ctx.fillText('✧', 45, 295);
  ctx.fillText('♡', 1100, 1370);
  ctx.strokeStyle = '#b2a78d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 1380);
  ctx.lineTo(1110, 1380);
  ctx.stroke();
  ctx.font = '25px sans-serif';
  const lines: string[] = [];
  for (const paragraph of stamp.note.split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > layout.note.width) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  const noteOutsideImage = lines.length > 4;
  if (stamp.note && !noteOutsideImage) {
    ctx.fillStyle = '#5d6857';
    lines.forEach((line, i) => ctx.fillText(line, layout.note.x, layout.note.y + 25 + i * 30));
  }
  ctx.fillStyle = '#9d9687';
  ctx.font = 'italic 19px Georgia';
  ctx.fillText('Small moments, kept with care.', 85, 1570);
  return {
    image: target.toDataURL('image/png'),
    layout,
    noteOutsideImage,
    sourceWidth: image.width,
    sourceHeight: image.height,
  };
}
