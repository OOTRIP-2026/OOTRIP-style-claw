// integrations/fitting-journal/miniprogram/wardrobe/realtime.ts
var REALTIME_CATEGORIES = ["\u5957\u88C5", "\u4E0A\u8863", "\u88E4\u5B50", "\u5916\u5957", "\u5185\u642D", "\u978B\u5B50", "\u914D\u9970"];
function realtimeCategory(category) {
  const aliases = {
    \u8FDE\u8863\u88D9: "\u5957\u88C5",
    \u4E0B\u88C5: "\u88E4\u5B50",
    \u978B: "\u978B\u5B50",
    \u9970\u54C1: "\u914D\u9970",
    \u5305: "\u914D\u9970"
  };
  const normalized = aliases[category] ?? category;
  return REALTIME_CATEGORIES.includes(normalized) ? normalized : "";
}

// integrations/fitting-journal/tools/lucy-demo/web/store.ts
var integrated = window.parent !== window && new URLSearchParams(location.search).get("integrated") === "1";
function hostWardrobe(method, items, remove = false) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("\u8863\u6A71\u54CD\u5E94\u8D85\u65F6\uFF0C\u8BF7\u8FD4\u56DE\u540E\u91CD\u65B0\u6253\u5F00\u3002"));
    }, 15e3);
    function receive(event) {
      if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== "ootrip:wardrobe-result" || event.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "ootrip:wardrobe-rpc", id, method, items, remove }, location.origin);
  });
}
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ootrip-html-demo-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("garments", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("\u6D4F\u89C8\u5668\u8863\u6A71\u65E0\u6CD5\u6253\u5F00\uFF0C\u8BF7\u5173\u95ED\u65E0\u75D5\u6A21\u5F0F\u540E\u91CD\u8BD5\u3002"));
  });
}
async function readWardrobe() {
  if (integrated) return hostWardrobe("read");
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("garments").objectStore("garments").getAll();
      request.onsuccess = () => resolve(
        request.result.filter(
          (item) => typeof item.id === "string" && typeof item.name === "string" && REALTIME_CATEGORIES.includes(item.category) && /^data:image\/(png|jpeg|webp);base64,/.test(item.image)
        )
      );
      request.onerror = () => reject(new Error("\u6D4F\u89C8\u5668\u8863\u6A71\u8BFB\u53D6\u5931\u8D25\u3002"));
    });
  } finally {
    db.close();
  }
}
async function importGarment(blob, name, category, preserveAlpha = false) {
  const normalized = realtimeCategory(category);
  if (!normalized || !["image/png", "image/jpeg", "image/webp"].includes(blob.type) || !blob.size || blob.size > 5 * 1024 * 1024)
    throw new Error("\u8BF7\u9009\u62E95MiB\u4EE5\u5185\u7684PNG\u3001JPEG\u6216WebP\u8863\u7269\u56FE\u7247\u3002");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 25e6)
      throw new Error("\u56FE\u7247\u50CF\u7D20\u8FC7\u5927\uFF0C\u8BF7\u7F29\u5C0F\u540E\u4E0A\u4F20\u3002");
    const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas2 = document.createElement("canvas");
    canvas2.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas2.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas2.getContext("2d");
    if (!context) throw new Error("\u6D4F\u89C8\u5668\u65E0\u6CD5\u521B\u5EFA\u9884\u89C8\u3002");
    if (!preserveAlpha) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas2.width, canvas2.height);
    }
    context.drawImage(image, 0, 0, canvas2.width, canvas2.height);
    return {
      id: crypto.randomUUID(),
      name: name.replace(/\.[^.]+$/, "").slice(0, 100),
      category: normalized,
      image: canvas2.toDataURL(preserveAlpha ? "image/png" : "image/jpeg", 0.9),
      purchased: true
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// integrations/fitting-journal/tools/lucy-demo/web/journal-model.ts
var JOURNAL_RULES = {
  mode: "standard",
  width: 1200,
  height: 1600,
  maxItems: 4,
  maxNote: 300,
  layoutVersion: "2.0",
  renderVersion: "2.0"
};
var WEATHER = [
  { id: "sunny", emoji: "\u2600\uFE0F", label: "\u6674\u5929", english: "Sunny" },
  { id: "partly_cloudy", emoji: "\u26C5", label: "\u591A\u4E91", english: "Cloudy" },
  { id: "rainy", emoji: "\u{1F327}\uFE0F", label: "\u4E0B\u96E8", english: "Rainy" },
  { id: "snowy", emoji: "\u2744\uFE0F", label: "\u4E0B\u96EA", english: "Snowy" },
  { id: "windy", emoji: "\u{1F32C}\uFE0F", label: "\u6709\u98CE", english: "Windy" }
];
var MOODS = [
  { id: "happy", emoji: "\u{1F60A}", label: "\u5F00\u5FC3" },
  { id: "relaxed", emoji: "\u{1F60C}", label: "\u677E\u5F1B" },
  { id: "loving", emoji: "\u{1F970}", label: "\u559C\u6B22\u4ECA\u5929" },
  { id: "sleepy", emoji: "\u{1F634}", label: "\u6709\u70B9\u56F0" },
  { id: "tender", emoji: "\u{1F97A}", label: "\u9700\u8981\u62B1\u62B1" }
];
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function validateNote(note2) {
  if (Array.from(note2).length > JOURNAL_RULES.maxNote)
    throw new Error("\u4E2A\u4EBA\u8BB0\u5F55\u6700\u591A300\u5B57\uFF0C\u8BF7\u7F29\u77ED\u540E\u751F\u6210\u3002");
  if (Array.from(note2).some(
    (char) => char.charCodeAt(0) < 32 && char !== "\n" && char !== "\r" && char !== "	"
  ))
    throw new Error("\u4E2A\u4EBA\u8BB0\u5F55\u5305\u542B\u4E0D\u652F\u6301\u7684\u63A7\u5236\u5B57\u7B26\u3002");
  return note2;
}
function selectPieces(items) {
  return items.filter(
    (item) => item.visibility !== "occluded" && (item.confidence == null || item.confidence >= 0.5)
  ).sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5)).slice(0, JOURNAL_RULES.maxItems);
}
function contain(rect, width, height) {
  const scale = Math.min(rect.width / width, rect.height / height);
  return {
    x: rect.x + (rect.width - width * scale) / 2,
    y: rect.y + (rect.height - height * scale) / 2,
    width: width * scale,
    height: height * scale
  };
}
function journalLayout(width, height, pieces, variant = 0) {
  if (!(width > 0 && height > 0)) throw new Error("\u7167\u7247\u5C3A\u5BF8\u65E0\u6548");
  const count = Math.min(pieces.length, JOURNAL_RULES.maxItems);
  const landscape = width / height > 1.12;
  const hero = contain(
    landscape ? { x: 90, y: 330, width: 1020, height: 650 } : count ? { x: 300, y: 320, width: 600, height: 970 } : { x: 140, y: 310, width: 920, height: 1030 },
    width,
    height
  );
  hero.x += (variant % 3 - 1) * 8;
  hero.y += variant % 2 * 8;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const piece = pieces[i];
    const index = variant % 2 ? count - 1 - i : i;
    const box = landscape ? {
      x: 90 + index * (1020 / count),
      y: 1060 + index % 2 * 18,
      width: 1020 / count - 30,
      height: 235
    } : {
      x: index % 2 ? 945 : 65,
      y: 420 + Math.floor(index / 2) * 430 + variant % 3 * 12,
      width: 190,
      height: 280
    };
    slots.push(contain(box, piece.width || 3, piece.height || 4));
  }
  return {
    version: JOURNAL_RULES.layoutVersion,
    variant,
    hero,
    pieces: slots,
    note: { x: 100, y: 1400, width: 1e3, height: 130 },
    landscape
  };
}

// integrations/fitting-journal/tools/lucy-demo/web/journal-storage.ts
async function database2() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ootrip-journal-v1", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries"))
        db.createObjectStore("entries", { keyPath: "id" });
      if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error("\u624B\u8D26\u5B58\u50A8\u65E0\u6CD5\u6253\u5F00\uFF0C\u8BF7\u4F7F\u7528\u666E\u901A\u6D4F\u89C8\u6A21\u5F0F\u3002"));
    request.onblocked = () => reject(new Error("\u8BF7\u5173\u95ED\u5176\u4ED6\u65E7\u7248\u624B\u8D26\u7A97\u53E3\u540E\u91CD\u8BD5\u3002"));
  });
}
async function entries(entry, remove) {
  const db = await database2();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("entries", entry || remove ? "readwrite" : "readonly");
      const store = tx.objectStore("entries");
      if (entry) store.put(entry);
      if (remove) store.delete(remove);
      const read = store.getAll();
      tx.oncomplete = () => resolve(read.result);
      tx.onabort = tx.onerror = () => reject(new Error("\u624B\u8D26\u4FDD\u5B58\u5931\u8D25\uFF0C\u53EF\u80FD\u7A7A\u95F4\u4E0D\u8DB3\uFF1B\u9884\u89C8\u4ECD\u4FDD\u7559\uFF0C\u53EF\u5148\u4E0B\u8F7D\u518D\u91CD\u8BD5\u3002"));
    });
  } finally {
    db.close();
  }
}
async function readDraft() {
  const db = await database2();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("drafts").objectStore("drafts").get("current");
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(new Error("\u8349\u7A3F\u8BFB\u53D6\u5931\u8D25\u3002"));
    });
  } finally {
    db.close();
  }
}
var writes = Promise.resolve();
function saveDraft(value) {
  const task = async () => {
    const db = await database2();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        const store = tx.objectStore("drafts");
        if (value) store.put(value, "current");
        else store.delete("current");
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error("\u8349\u7A3F\u672A\u80FD\u4FDD\u5B58\uFF0C\u8BF7\u4FDD\u6301\u672C\u9875\u6253\u5F00\u3002"));
      });
    } finally {
      db.close();
    }
  };
  writes = writes.catch(() => void 0).then(task);
  return writes;
}

// integrations/fitting-journal/tools/lucy-demo/web/journal-renderer.ts
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("\u7167\u7247\u65E0\u6CD5\u89E3\u7801\u3002"));
    image.src = source;
  });
}
async function composeArtworkLegacy(artwork2, stamp, variant = 0) {
  const image = await loadImage(artwork2);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = "#f5f1e9";
  ctx.fillRect(0, 0, 1200, 1600);
  const hero = contain({ x: 0, y: 0, width: 1200, height: 1344 }, image.width, image.height);
  ctx.drawImage(image, hero.x, hero.y, hero.width, hero.height);
  ctx.fillStyle = "#f5f1e9";
  ctx.fillRect(0, 1344, 1200, 256);
  ctx.fillStyle = "#536c77";
  ctx.font = "30px Georgia";
  ctx.fillText(stamp.time.replace(/-/g, " / "), 70, 1395);
  ctx.font = "34px sans-serif";
  ctx.fillText([stamp.weather, stamp.mood].filter(Boolean).join("  "), 940, 1395);
  ctx.font = "25px sans-serif";
  ctx.fillStyle = "#5f5a50";
  const lines = [];
  for (const paragraph of stamp.note.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > 1060) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  const noteOutsideImage = lines.length > 3;
  if (stamp.note && !noteOutsideImage)
    lines.forEach((line, index) => ctx.fillText(line, variant % 2 ? 90 : 70, 1445 + index * 31));
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#999083";
  ctx.fillText("OOTRIP \xB7 AI\u526A\u8D34\u521B\u4F5C", 70, 1570);
  return {
    image: target.toDataURL("image/png"),
    noteOutsideImage,
    layout: {
      version: "3.0-ai",
      variant,
      hero,
      pieces: [],
      note: { x: 70, y: 1420, width: 1060, height: 110 },
      landscape: false
    },
    sourceWidth: image.width,
    sourceHeight: image.height
  };
}
async function composeArtwork(artwork2, stamp, variant = 0, integrated2 = true) {
  if (!integrated2) return composeArtworkLegacy(artwork2, stamp, variant);
  const image = await loadImage(artwork2);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = "#f5f1e9";
  ctx.fillRect(0, 0, 1200, 1600);
  const hero = contain({ x: 0, y: 0, width: 1200, height: 1600 }, image.width, image.height);
  ctx.drawImage(image, hero.x, hero.y, hero.width, hero.height);
  const ink = artworkInk(ctx, target.width, target.height);
  const hand = '"KaiTi", "STKaiti", "Segoe Print", cursive';
  const paper = (x, y, w, h, angle, draw) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = "#51473520";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#fffaf0ed";
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 3);
    ctx.lineTo(w / 2 - 4, -h / 2);
    ctx.lineTo(w / 2, h / 2 - 3);
    ctx.lineTo(-w / 2 + 3, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = ink;
    draw();
    ctx.restore();
  };
  paper(1020, 1295, 240, 75, variant % 2 ? 0.035 : -0.055, () => {
    ctx.font = "italic 27px " + hand;
    ctx.textAlign = "center";
    ctx.fillText(stamp.time.replace(/-/g, " / "), 0, 10, 220);
  });
  const emojis = [stamp.weather, stamp.mood].filter(Boolean);
  if (emojis.length)
    paper(1030, 295, 190, 100, 0.065, () => {
      ctx.textAlign = "center";
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
    let fontSize = 27;
    let lines = [];
    const wrap = () => {
      ctx.font = fontSize + "px " + hand;
      const output = [];
      for (const paragraph of stamp.note.split("\n")) {
        let line = "";
        for (const char of Array.from(paragraph)) {
          if (ctx.measureText(line + char).width > 270 && line) {
            output.push(line);
            line = "";
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
          ctx.font = fontSize + "px " + hand;
          ctx.textAlign = "left";
          lines.forEach(
            (line, index) => ctx.fillText(
              line,
              -134,
              (index - (lines.length - 1) / 2) * fontSize * 1.35 + fontSize / 3
            )
          );
        }
      );
  }
  ctx.font = "14px sans-serif";
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.65;
  ctx.fillText("OOTRIP \xB7 AI\u526A\u8D34\u521B\u4F5C", 35, 1570);
  ctx.globalAlpha = 1;
  return {
    image: target.toDataURL("image/png"),
    noteOutsideImage,
    layout: {
      version: "4.0-ai",
      variant,
      hero,
      pieces: [],
      note: { x: 53, y: 1060, width: 308, height: 250 },
      landscape: false
    },
    sourceWidth: image.width,
    sourceHeight: image.height
  };
}
function artworkInk(ctx, width, height) {
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4 * 173) {
    const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
    const light = (red + green + blue) / 3;
    if (light > 55 && light < 210 && Math.max(red, green, blue) - Math.min(red, green, blue) > 15) {
      r += red;
      g += green;
      b += blue;
      count++;
    }
  }
  if (!count) return "#5b6359";
  return "rgb(" + [r, g, b].map((v) => Math.round(v / count * 0.48)).join(",") + ")";
}
function canvas(width, height) {
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u753B\u5E03\u3002");
  return { target, ctx };
}
async function compose(source, pieces, stamp, variant = 0) {
  const image = await loadImage(source);
  const layout = journalLayout(image.width, image.height, pieces, variant);
  const { target, ctx } = canvas(1200, 1600);
  ctx.fillStyle = "#f5f1e9";
  ctx.fillRect(0, 0, 1200, 1600);
  for (let i = 0; i < 9e3; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff65" : "#8c806018";
    ctx.fillRect(i * 739 % 1200, i * 431 % 1600, 1, 2);
  }
  ctx.fillStyle = "#59624f";
  ctx.font = "20px Georgia";
  ctx.fillText("O O T R I P   /   O U T F I T   D I A R Y", 85, 85);
  ctx.font = 'italic 62px "Segoe Print", Georgia, cursive';
  ctx.fillText(variant % 2 ? "Wear the moment." : "A day to remember.", 85, 173);
  ctx.font = "26px sans-serif";
  ctx.fillText(stamp.time.replace(/-/g, " / "), 88, 235);
  ctx.font = "35px sans-serif";
  ctx.fillText([stamp.weather, stamp.mood].filter(Boolean).join("  "), 880, 235);
  const frame = async (src, rect) => {
    const img = await loadImage(src);
    ctx.save();
    ctx.shadowColor = "#65573b28";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(rect.x - 12, rect.y - 12, rect.width + 24, rect.height + 34);
    ctx.restore();
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  };
  await frame(source, layout.hero);
  ctx.fillStyle = "#c6b89b99";
  ctx.fillRect(layout.hero.x + layout.hero.width / 2 - 65, layout.hero.y - 28, 130, 36);
  for (let i = 0; i < layout.pieces.length; i++) {
    const piece = pieces[i];
    const rect = layout.pieces[i];
    await frame(piece.image, rect);
    ctx.fillStyle = "#696953";
    ctx.font = "18px sans-serif";
    ctx.fillText(piece.name, rect.x, rect.y + rect.height + 52, rect.width);
  }
  ctx.fillStyle = "#898773";
  ctx.font = "38px Georgia";
  ctx.fillText("\u2727", 45, 295);
  ctx.fillText("\u2661", 1100, 1370);
  ctx.strokeStyle = "#b2a78d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 1380);
  ctx.lineTo(1110, 1380);
  ctx.stroke();
  ctx.font = "25px sans-serif";
  const lines = [];
  for (const paragraph of stamp.note.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (ctx.measureText(line + char).width > layout.note.width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  const noteOutsideImage = lines.length > 4;
  if (stamp.note && !noteOutsideImage) {
    ctx.fillStyle = "#5d6857";
    lines.forEach((line, i) => ctx.fillText(line, layout.note.x, layout.note.y + 25 + i * 30));
  }
  ctx.fillStyle = "#9d9687";
  ctx.font = "italic 19px Georgia";
  ctx.fillText("Small moments, kept with care.", 85, 1570);
  return {
    image: target.toDataURL("image/png"),
    layout,
    noteOutsideImage,
    sourceWidth: image.width,
    sourceHeight: image.height
  };
}

// integrations/fitting-journal/tools/lucy-demo/web/journal.ts
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`\u7F3A\u5C11\u754C\u9762\u8282\u70B9${id}`);
  return node;
}
var history = element("history");
var editor = element("editor");
var result = element("result");
var time = element("record-time");
var note = element("note");
var consent = element("recognize");
var loading = element("loading");
var photo = "";
var sourceName = "";
var weather = "";
var mood = "";
var original;
var recognition = null;
var current;
var editId = null;
var entries2 = [];
var busy = false;
var saved = true;
var restoring = true;
var controller;
var manualPieces = [];
var artwork = "";
var artworkModel = "";
var artworkVersion = 3;
var mode = element("journal-mode");
var serviceStatus;
var artworkStatus;
function refreshService() {
  const ai = mode.value === "ai-paper";
  const status = ai ? artworkStatus : serviceStatus;
  element("service").textContent = status?.message ?? "\u6B63\u5728\u68C0\u67E5\u670D\u52A1\u2026";
  consent.disabled = !status?.configured;
  element("consent-label").textContent = ai ? "\u6211\u540C\u610F\u5C06\u672C\u6B21\u7167\u7247\u53D1\u9001\u81F3\u963F\u91CC\u4E91\u767E\u70BC\u751F\u6210\u4E00\u5F20AI\u526A\u8D34\u624B\u8D26\uFF0C\u5E76\u6D88\u8017\u56FE\u50CF\u6A21\u578B\u989D\u5EA6\u3002AI\u53EF\u80FD\u91CD\u7ED8\u7EC6\u8282\u3002" : "\u6211\u540C\u610F\u5C06\u672C\u6B21\u7167\u7247\u53D1\u9001\u81F3\u963F\u91CC\u4E91\u767E\u70BC\u8BC6\u522B\u53EF\u89C1\u8863\u7269\uFF0C\u5E76\u6D88\u8017\u8BC6\u522B\u6A21\u578B\u989D\u5EA6\u3002\u4E0D\u52FE\u9009\u53EA\u5728\u672C\u673A\u6392\u7248\u3002";
}
mode.onchange = () => {
  consent.checked = false;
  refreshService();
  persistDraft();
};
function state(value, message) {
  document.body.dataset.state = value;
  element("loading-phase").textContent = message;
}
function showError(value) {
  const message = value instanceof Error ? value.message : "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
  element("error").textContent = message;
  if (!result.hidden) element("result-note").textContent = message;
  if (!history.hidden) element("history-status").textContent = message;
}
function screen(name) {
  history.hidden = name !== "history";
  editor.hidden = name !== "editor";
  result.hidden = name !== "result";
  window.scrollTo(0, 0);
}
function setPhoto() {
  const image = element("photo-preview");
  if (photo) image.src = photo;
  else image.removeAttribute("src");
  image.hidden = !photo;
  element("photo").required = !photo;
}
function refreshOptions() {
  for (const id of ["weather", "mood"])
    for (const button of element(id).children)
      button.setAttribute(
        "aria-pressed",
        String(button.textContent === (id === "weather" ? weather : mood))
      );
  element("note-count").textContent = `${Array.from(note.value).length}/300\u5B57`;
}
function persistDraft() {
  if (restoring) return;
  void saveDraft({
    sourceImage: photo,
    manualPieces,
    artwork,
    artworkModel,
    artworkVersion,
    mode: mode.value === "ai-paper" ? "ai-paper" : "standard",
    ...original ? { sourceOriginal: original } : {},
    sourceName,
    date: time.value,
    weatherId: WEATHER.find((v) => v.emoji === weather)?.id ?? null,
    moodId: MOODS.find((v) => v.emoji === mood)?.id ?? null,
    note: note.value,
    editId,
    recognition,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).catch(showError);
}
function resetDate() {
  const now = /* @__PURE__ */ new Date();
  time.value = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}
for (const [id, values] of [
  ["weather", WEATHER],
  ["mood", MOODS]
]) {
  for (const option of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.emoji;
    button.title = option.label;
    button.setAttribute("aria-label", option.label);
    button.setAttribute("aria-pressed", "false");
    button.onclick = () => {
      if (busy) return;
      const value = button.getAttribute("aria-pressed") === "true" ? "" : option.emoji;
      if (id === "weather") weather = value;
      else mood = value;
      refreshOptions();
      persistDraft();
    };
    element(id).append(button);
  }
}
element("new-record").onclick = () => screen("editor");
element("back").onclick = () => {
  persistDraft();
  screen("history");
};
element("result-back").onclick = () => {
  if (!saved && !window.confirm("\u8FD9\u5F20\u9884\u89C8\u5C1A\u672A\u4FDD\u5B58\uFF0C\u786E\u8BA4\u8FD4\u56DE\uFF1F\u539F\u7167\u7247\u548C\u6587\u5B57\u8349\u7A3F\u4ECD\u4FDD\u7559\u3002")) return;
  render();
  screen("history");
};
async function choose(input) {
  const file = input.files?.[0];
  if (!file || busy) return;
  busy = true;
  state("uploading", "\u6B63\u5728\u5904\u7406\u672C\u673A\u7167\u7247\u2026");
  element("generate").disabled = true;
  try {
    const normalized = await importGarment(file, "\u7A7F\u642D\u7167\u7247", "\u4E0A\u8863");
    photo = normalized.image;
    original = file;
    sourceName = file.name;
    recognition = null;
    artwork = "";
    artworkModel = "";
    consent.checked = false;
    setPhoto();
    persistDraft();
    state("ready", "\u7167\u7247\u5DF2\u5C31\u7EEA");
    element("error").textContent = "";
  } catch (value) {
    state("failed", "\u7167\u7247\u5904\u7406\u5931\u8D25");
    showError(value);
  } finally {
    busy = false;
    input.value = "";
    element("generate").disabled = false;
  }
}
for (const id of ["photo", "take-photo"]) {
  const input = element(id);
  input.onchange = () => void choose(input);
}
element("remove-photo").onclick = () => {
  if (busy) return;
  photo = "";
  original = void 0;
  recognition = null;
  artwork = "";
  artworkModel = "";
  sourceName = "";
  consent.checked = false;
  setPhoto();
  persistDraft();
  state("idle", "\u8BF7\u9009\u62E9\u7167\u7247");
};
var draftTimer;
element("rotate-photo").onclick = () => {
  if (!photo || busy) return;
  busy = true;
  void loadImage(photo).then((image) => {
    const { target, ctx } = canvas(image.height, image.width);
    ctx.translate(target.width / 2, target.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    photo = target.toDataURL("image/jpeg", 0.9);
    recognition = null;
    artwork = "";
    artworkModel = "";
    consent.checked = false;
    setPhoto();
    persistDraft();
  }).catch(showError).finally(() => {
    busy = false;
  });
};
note.oninput = () => {
  refreshOptions();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(persistDraft, 250);
};
time.onchange = persistDraft;
function showResult(entry) {
  current = entry;
  element("new-artwork").hidden = entry.mode !== "ai-paper";
  element("regenerate").textContent = entry.mode === "ai-paper" ? "\u8C03\u6574\u6587\u5B57\u6392\u7248\uFF08\u4E0D\u8C03\u7528AI\uFF09" : "\u6362\u4E00\u79CD\u6392\u7248";
  element("scrapbook").src = entry.image;
  element("full-note").textContent = entry.note;
  element("full-note").hidden = !entry.note;
  element("result-note").textContent = (entry.mode === "ai-paper" ? "AI\u526A\u8D34\u624B\u8D26\uFF1A\u53C2\u8003\u539F\u7167\u7247\u751F\u6210\uFF0C\u4EBA\u7269\u53CA\u8863\u7269\u7EC6\u8282\u53EF\u80FD\u91CD\u7ED8\uFF0C\u975E\u7CBE\u786E\u62A0\u56FE\u3002" : entry.pieces.some((piece) => piece.extraction === "manual") ? "\u624B\u52A8\u62FC\u8D34\uFF1A\u4F7F\u7528\u539F\u7167\u7247\u4E0E\u81EA\u884C\u9009\u62E9\u7684\u5355\u54C1\u56FE\u7247\uFF0C\u4E0D\u8C03\u7528AI\uFF0C\u672A\u81EA\u52A8\u62A0\u56FE\u3002" : entry.recognized ? "\u5355\u54C1\u6765\u81EA\u8BC6\u522B\u533A\u57DF\u88C1\u7247\uFF0C\u53EF\u80FD\u5E26\u6709\u80CC\u666F\uFF1B\u5C1A\u975E\u7CBE\u786E\u62A0\u56FE\u3002" : "\u672C\u673A\u7EB8\u827A\u62FC\u8D34\uFF1A\u4F7F\u7528\u771F\u5B9E\u7167\u7247\uFF0C\u6CA1\u6709\u53D1\u9001AI\u3002") + (entry.noteOutsideImage ? " \u6587\u5B57\u8F83\u957F\uFF0C\u5B8C\u6574\u4FDD\u7559\u5728\u56FE\u7247\u4E0B\u65B9\u53CA\u8BB0\u5F55\u4E2D\uFF0C\u672A\u622A\u65AD\u3002" : "");
  const button = element("save-entry");
  button.disabled = saved;
  button.textContent = saved ? "\u5DF2\u4FDD\u5B58\u5230\u624B\u8D26" : "\u786E\u8BA4\u4FDD\u5B58\u5230\u624B\u8D26";
  screen("result");
}
async function generate(localOnly = false) {
  if (busy) return;
  if (!photo || !validDate(time.value)) {
    showError(new Error("\u8BF7\u5148\u9009\u62E9\u7167\u7247\u548C\u6709\u6548\u65E5\u671F\u3002"));
    return;
  }
  try {
    validateNote(note.value);
  } catch (value) {
    showError(value);
    return;
  }
  const aiArtwork = !localOnly && mode.value === "ai-paper";
  if (aiArtwork && !artwork && !consent.checked) {
    showError(new Error("\u8BF7\u5148\u52FE\u9009\u672C\u6B21AI\u56FE\u50CF\u5904\u7406\u540C\u610F\uFF0C\u6216\u9009\u62E9\u672C\u673A\u624B\u8D26\u3002"));
    return;
  }
  if (aiArtwork && !artwork && !artworkStatus?.configured) {
    showError(new Error(artworkStatus?.message ?? "\u6B63\u5728\u68C0\u67E5\u56FE\u50CF\u670D\u52A1\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002"));
    return;
  }
  busy = true;
  controller = new AbortController();
  const active = controller;
  const snapshot = { time: time.value, weather, mood, note: note.value };
  const source = photo;
  const submit = element("generate");
  submit.disabled = true;
  element("error").textContent = "";
  loading.showModal();
  persistDraft();
  try {
    let analysis = localOnly || aiArtwork ? null : recognition;
    if (aiArtwork && !artwork) {
      state("recognizing", "AI\u6B63\u5728\u5236\u4F5C\u4EBA\u7269\u4E0E\u5355\u54C1\u526A\u8D34\uFF0C\u901A\u5E38\u9700\u8981\u7B49\u5F85\uFF0C\u6682\u4E0D\u91CD\u590D\u70B9\u51FB\u2026");
      const response = await fetch("/journal/artwork", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lucy-experiment": document.querySelector("meta[name=lucy-experiment]")?.content ?? ""
        },
        body: JSON.stringify({ image: source, consent: true, requestId: crypto.randomUUID() }),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(25e4)])
      });
      const data = await response.json();
      if (!response.ok || !data.image?.startsWith("data:image/png;base64,"))
        throw new Error(data.message ?? "AI\u624B\u8D26\u7ED3\u679C\u65E0\u6548\uFF0C\u672A\u81EA\u52A8\u91CD\u8BD5\u3002");
      artwork = data.image;
      artworkModel = data.model ?? "qwen-image-2.0";
      artworkVersion = 4;
      persistDraft();
    }
    if (!localOnly && !aiArtwork && consent.checked && !analysis) {
      state("recognizing", "\u6B63\u5728\u8BF7\u6C42\u8863\u7269\u8BC6\u522B\u2026");
      const response = await fetch("/journal/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lucy-experiment": document.querySelector("meta[name=lucy-experiment]")?.content ?? ""
        },
        body: JSON.stringify({ image: source, consent: true }),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(5e4)])
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "\u8BC6\u522B\u5931\u8D25\uFF0C\u53EF\u9009\u62E9\u4E0B\u65B9\u672C\u673A\u624B\u8D26\u7EE7\u7EED\u3002");
      analysis = { items: data.items, ...data.person ? { person: data.person } : {} };
      recognition = analysis;
      persistDraft();
    }
    active.signal.throwIfAborted();
    state("composing", "\u6B63\u5728\u6574\u7406\u771F\u5B9E\u7167\u7247\u4E0E\u5355\u54C1\u533A\u57DF\u2026");
    const pieces = localOnly ? [...manualPieces] : [];
    if (analysis) {
      const image = await loadImage(source);
      for (const item of selectPieces(analysis.items)) {
        const [x1, y1, x2, y2] = item.box;
        const w = (x2 - x1) * image.width / 1e3, h = (y2 - y1) * image.height / 1e3;
        const scale = Math.min(1, 320 / Math.max(w, h));
        const { target, ctx } = canvas(
          Math.max(1, Math.round(w * scale)),
          Math.max(1, Math.round(h * scale))
        );
        ctx.drawImage(
          image,
          x1 * image.width / 1e3,
          y1 * image.height / 1e3,
          w,
          h,
          0,
          0,
          target.width,
          target.height
        );
        pieces.push({
          name: item.name,
          image: target.toDataURL("image/jpeg", 0.9),
          width: target.width,
          height: target.height,
          box: item.box,
          extraction: "region-crop",
          ...item.confidence != null ? { confidence: item.confidence } : {}
        });
      }
    }
    for (const piece of pieces) {
      if (piece.extraction === "manual") {
        const image = await loadImage(piece.image);
        piece.width = image.width;
        piece.height = image.height;
      }
    }
    state("rendering", "\u6B63\u5728\u7ED8\u5236\u7EB8\u5F20\u3001\u7167\u7247\u4E0E\u4E2A\u4EBA\u8BB0\u5F55\u2026");
    await new Promise(
      (resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const rendered = aiArtwork ? await composeArtwork(artwork, snapshot, 0, artworkVersion >= 4) : await compose(source, pieces, snapshot);
    active.signal.throwIfAborted();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const entry = {
      id: editId ?? crypto.randomUUID(),
      ...snapshot,
      ...rendered,
      pieces,
      manualPieces: [...manualPieces],
      recognized: analysis !== null,
      schemaVersion: 2,
      sourceImage: source,
      ...original ? { sourceOriginal: original } : {},
      sourceName,
      recognition: analysis,
      weatherId: WEATHER.find((v) => v.emoji === weather)?.id ?? null,
      moodId: MOODS.find((v) => v.emoji === mood)?.id ?? null,
      mode: aiArtwork ? "ai-paper" : "standard",
      ...aiArtwork ? { artwork, artworkModel, artworkVersion } : {},
      layoutVersion: rendered.layout.version,
      renderVersion: aiArtwork ? rendered.layout.version : JOURNAL_RULES.renderVersion,
      createdAt: entries2.find((v) => v.id === editId)?.createdAt ?? now,
      updatedAt: now,
      status: "completed"
    };
    saved = false;
    showResult(entry);
    state("completed", "\u9884\u89C8\u5B8C\u6210\uFF0C\u786E\u8BA4\u540E\u4FDD\u5B58\u8BB0\u5F55");
  } catch (value) {
    state("failed", "\u751F\u6210\u672A\u5B8C\u6210");
    showError(value);
  } finally {
    loading.close();
    busy = false;
    submit.disabled = false;
  }
}
element("record-form").onsubmit = (event) => {
  event.preventDefault();
  void generate();
};
element("local-only").onclick = () => void generate(true);
var cancel = () => controller?.abort(new Error("\u5DF2\u53D6\u6D88\u672C\u5730\u7B49\u5F85\uFF1B\u5DF2\u53D1\u9001\u7684\u8BC6\u522B\u53EF\u80FD\u4ECD\u5B8C\u6210\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8BD5\u3002"));
loading.addEventListener("cancel", cancel);
element("cancel-generation").onclick = cancel;
window.addEventListener("pagehide", cancel);
element("save-entry").onclick = () => {
  if (!current || busy || saved) return;
  busy = true;
  state("saving", "\u6B63\u5728\u4FDD\u5B58\u5230\u5F53\u524D\u6D4F\u89C8\u5668\u2026");
  const button = element("save-entry");
  button.disabled = true;
  button.textContent = "\u6B63\u5728\u4FDD\u5B58\u2026";
  void entries(current).then(async (values) => {
    entries2 = values;
    saved = true;
    button.textContent = "\u5DF2\u4FDD\u5B58\u5230\u624B\u8D26";
    window.clearTimeout(draftTimer);
    await saveDraft(null);
    manualPieces = [];
    renderManual();
    photo = "";
    original = void 0;
    recognition = null;
    artwork = "";
    artworkModel = "";
    note.value = "";
    weather = "";
    mood = "";
    editId = null;
    setPhoto();
    refreshOptions();
    resetDate();
    render();
    state("completed", "\u5DF2\u4FDD\u5B58");
  }).catch((value) => {
    showError(value);
    button.textContent = saved ? "\u8BB0\u5F55\u5DF2\u4FDD\u5B58\uFF0C\u8349\u7A3F\u6E05\u7406\u5931\u8D25" : "\u91CD\u8BD5\u4FDD\u5B58";
  }).finally(() => {
    busy = false;
    button.disabled = saved;
  });
};
element("edit-entry").onclick = () => {
  if (!current || busy) return;
  manualPieces = (current.manualPieces ?? []).map((piece) => ({ ...piece }));
  renderManual();
  photo = current.sourceImage ?? "";
  original = current.sourceOriginal;
  sourceName = current.sourceName ?? "";
  time.value = current.time.slice(0, 10);
  weather = current.weather;
  mood = current.mood;
  note.value = current.note;
  recognition = current.recognition ?? null;
  artwork = current.artwork ?? "";
  artworkModel = current.artworkModel ?? "";
  artworkVersion = current.artworkVersion ?? 3;
  mode.value = current.mode ?? "standard";
  refreshService();
  editId = current.id;
  consent.checked = false;
  setPhoto();
  refreshOptions();
  screen("editor");
  persistDraft();
  if (!photo) showError(new Error("\u65E7\u8BB0\u5F55\u672A\u4FDD\u5B58\u539F\u7167\u7247\uFF0C\u8BF7\u91CD\u65B0\u4E0A\u4F20\u540E\u7F16\u8F91\u3002"));
  else element("error").textContent = recognition ? "\u6CBF\u7528\u8BE5\u7167\u7247\u5DF2\u6709\u7684\u8BC6\u522B\u7ED3\u679C\uFF0C\u4E0D\u91CD\u590D\u53D1\u9001AI\u3002" : "";
};
element("regenerate").onclick = () => {
  if (busy) return;
  if (!current?.sourceImage) {
    showError(new Error("\u65E7\u8BB0\u5F55\u8BF7\u5148\u7F16\u8F91\u5E76\u8865\u5145\u539F\u7167\u7247\u3002"));
    return;
  }
  busy = true;
  const entry = current;
  void (entry.mode === "ai-paper" && entry.artwork ? composeArtwork(
    entry.artwork,
    entry,
    (entry.layout?.variant ?? 0) + 1,
    (entry.artworkVersion ?? 3) >= 4
  ) : compose(current.sourceImage, entry.pieces, entry, (entry.layout?.variant ?? 0) + 1)).then((rendered) => {
    saved = false;
    showResult({ ...entry, ...rendered, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }).catch(showError).finally(() => {
    busy = false;
  });
};
function download() {
  if (!current) return;
  const link = document.createElement("a");
  link.href = current.image;
  link.download = `OOTRIP-${current.time.slice(0, 10)}.png`;
  link.click();
}
element("download").onclick = download;
element("share").onclick = () => {
  if (!current) return;
  const entry = current;
  void (async () => {
    const blob = await (await fetch(entry.image)).blob();
    const file = new File([blob], `OOTRIP-${entry.time.slice(0, 10)}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "\u6211\u7684\u7A7F\u8863\u624B\u8D26" });
      } catch (value) {
        if (!(value instanceof DOMException && value.name === "AbortError")) showError(value);
      }
    } else {
      download();
      element("result-note").textContent = "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u76F4\u63A5\u5206\u4EAB\uFF0C\u5DF2\u63D0\u4F9B\u56FE\u7247\u4E0B\u8F7D\uFF0C\u8BF7\u4ECE\u76F8\u518C\u6216\u4E0B\u8F7D\u76EE\u5F55\u5206\u4EAB\u3002";
    }
  })().catch(showError);
};
resetDate();
state("idle", "\u8BF7\u9009\u62E9\u7167\u7247");
void entries().then((values) => {
  entries2 = values;
  render();
}).catch(showError);
void readDraft().then((draft) => {
  if (draft) {
    manualPieces = draft.manualPieces ?? [];
    renderManual();
    photo = draft.sourceImage;
    original = draft.sourceOriginal;
    sourceName = draft.sourceName;
    time.value = draft.date;
    weather = WEATHER.find((v) => v.id === draft.weatherId)?.emoji ?? "";
    mood = MOODS.find((v) => v.id === draft.moodId)?.emoji ?? "";
    note.value = draft.note;
    editId = draft.editId;
    recognition = draft.recognition;
    artwork = draft.artwork ?? "";
    artworkModel = draft.artworkModel ?? "";
    artworkVersion = draft.artworkVersion ?? 3;
    mode.value = draft.mode ?? "ai-paper";
    refreshService();
    setPhoto();
    refreshOptions();
    element("history-status").textContent = "\u5DF2\u6062\u590D\u672A\u5B8C\u6210\u8349\u7A3F\uFF0C\u70B9\u51FB\u8BB0\u5F55\u4ECA\u5929\u7A7F\u642D\u7EE7\u7EED\u3002";
  }
}).catch(showError).finally(() => {
  restoring = false;
});
void fetch("/journal/status").then((response) => response.json()).then((data) => {
  serviceStatus = data;
  refreshService();
}).catch(() => {
  serviceStatus = { configured: false, message: "\u8BC6\u522B\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u4ECD\u53EF\u5236\u4F5C\u672C\u673A\u624B\u8D26\u3002" };
  refreshService();
});
function render() {
  const list = element("records");
  list.replaceChildren();
  if (!entries2.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const star = document.createElement("span");
    star.textContent = "\u2727";
    empty.append(star, document.createTextNode("\u8FD8\u6CA1\u6709\u8BB0\u5F55\uFF0C\u7559\u4F4F\u4ECA\u5929\u7684\u7B2C\u4E00\u5957\u7A7F\u642D\u5427\u3002"));
    list.append(empty);
    return;
  }
  let month = "";
  for (const entry of [...entries2].sort((a, b) => b.time.localeCompare(a.time))) {
    const date = /* @__PURE__ */ new Date(`${entry.time.slice(0, 10)}T00:00:00`);
    const group = `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708`;
    if (group !== month) {
      const title = document.createElement("h2");
      title.className = "month";
      title.textContent = group;
      list.append(title);
      month = group;
    }
    const row = document.createElement("article");
    row.className = "record";
    const dateBox = document.createElement("div");
    dateBox.className = "date";
    const day = document.createElement("strong");
    day.textContent = String(date.getDate());
    const weekday = document.createElement("small");
    weekday.textContent = `\u5468${"\u65E5\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D"[date.getDay()]}`;
    const emojis = document.createElement("div");
    emojis.className = "emojis";
    for (const value of [entry.weather, entry.mood].filter(Boolean)) {
      const badge = document.createElement("span");
      badge.textContent = value;
      emojis.append(badge);
    }
    dateBox.append(day, weekday, emojis);
    const pieces = document.createElement("div");
    pieces.className = "pieces";
    if (entry.pieces.length)
      for (const piece of entry.pieces) {
        const image = document.createElement("img");
        image.src = piece.image;
        image.alt = piece.name;
        image.title = `${piece.name}\uFF08${piece.extraction === "manual" ? "\u624B\u52A8\u9009\u62E9" : "\u8BC6\u522B\u533A\u57DF\u88C1\u7247"}\uFF09`;
        pieces.append(image);
      }
    else {
      const image = document.createElement("img");
      image.src = entry.image;
      image.alt = "\u624B\u8D26\u5C01\u9762\uFF0C\u672A\u8BC6\u522B\u5355\u54C1";
      pieces.append(image);
      const label = document.createElement("small");
      label.textContent = entry.mode === "ai-paper" ? "AI\u526A\u8D34\u624B\u8D26" : entry.recognized ? "\u672A\u68C0\u6D4B\u5230\u53EF\u89C1\u8863\u7269" : "\u672C\u673A\u62FC\u8D34 \xB7 \u672A\u8BC6\u522B\u8863\u7269";
      pieces.append(label);
    }
    const actions = document.createElement("div");
    actions.className = "record-actions";
    const open = document.createElement("button");
    open.textContent = "\u67E5\u770B";
    open.onclick = () => {
      saved = true;
      showResult(entry);
    };
    const remove = document.createElement("button");
    remove.textContent = "\u5220\u9664";
    remove.onclick = () => {
      if (!window.confirm("\u5220\u9664\u8FD9\u6761\u624B\u8D26\u548C\u672C\u673A\u56FE\u7247\uFF1F\u5DF2\u4E0B\u8F7D\u7684\u56FE\u7247\u4E0D\u53D7\u5F71\u54CD\u3002")) return;
      void entries(void 0, entry.id).then((values) => {
        entries2 = values;
        render();
      }).catch(showError);
    };
    actions.append(open, remove);
    row.append(dateBox, pieces, actions);
    list.append(row);
  }
}
void fetch("/journal/artwork/status").then((response) => response.json()).then((data) => {
  artworkStatus = data;
  refreshService();
}).catch(() => {
  artworkStatus = { configured: false, message: "\u56FE\u50CF\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u542FHTML\u670D\u52A1\u540E\u518D\u8BD5\u3002" };
  refreshService();
});
element("new-artwork").onclick = () => {
  if (busy || !current) return;
  element("edit-entry").click();
  artwork = "";
  artworkModel = "";
  consent.checked = false;
  persistDraft();
  element("error").textContent = "\u4E0B\u6B21\u751F\u6210\u4F1A\u91CD\u65B0\u8C03\u7528\u56FE\u50CF\u6A21\u578B\u5E76\u6D88\u8017\u989D\u5EA6\uFF0C\u8BF7\u52FE\u9009\u672C\u6B21\u540C\u610F\u540E\u786E\u8BA4\u3002";
};
function renderManual() {
  const list = element("manual-selected");
  list.replaceChildren();
  manualPieces.forEach((piece, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const image = document.createElement("img");
    image.src = piece.image;
    image.alt = piece.name;
    button.append(image, document.createTextNode(piece.name + " \xD7\u79FB\u9664"));
    button.onclick = () => {
      if (busy) return;
      manualPieces.splice(index, 1);
      renderManual();
      persistDraft();
    };
    list.append(button);
  });
  for (const button of element("manual-wardrobe").querySelectorAll("button"))
    button.setAttribute(
      "aria-pressed",
      String(manualPieces.some((p) => p.image === button.dataset.image))
    );
}
function addManual(piece) {
  if (manualPieces.some((p) => p.image === piece.image)) return;
  if (manualPieces.length >= JOURNAL_RULES.maxItems) throw new Error("\u6700\u591A\u9009\u62E94\u4EF6\uFF0C\u8BF7\u5148\u79FB\u9664\u4E00\u4EF6\u3002");
  manualPieces.push({ ...piece, extraction: "manual" });
  renderManual();
  persistDraft();
}
async function openManual() {
  const panel = element("manual-panel");
  panel.open = true;
  const list = element("manual-wardrobe");
  list.replaceChildren();
  try {
    const garments = await readWardrobe();
    for (const garment of garments) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.image = garment.image;
      const image = document.createElement("img");
      image.src = garment.image;
      image.alt = garment.name;
      button.append(image, document.createTextNode(garment.name));
      button.onclick = () => {
        if (busy) return;
        try {
          const index = manualPieces.findIndex((p) => p.image === garment.image);
          if (index >= 0) manualPieces.splice(index, 1);
          else addManual({ name: garment.name, image: garment.image, category: garment.category });
          renderManual();
          persistDraft();
        } catch (error) {
          manualError(error);
        }
      };
      list.append(button);
    }
    element("manual-message").textContent = garments.length ? "\u70B9\u51FB\u8863\u7269\u9009\u62E9\u6216\u53D6\u6D88\u3002" : "\u5F53\u524D\u6D4F\u89C8\u5668\u8863\u6A71\u4E3A\u7A7A\uFF0C\u53EF\u4EE5\u76F4\u63A5\u4E0A\u4F20\u5355\u54C1\uFF0C\u4E5F\u53EF\u4EE5\u53EA\u7528\u539F\u7167\u7247\u6392\u7248\u3002";
    renderManual();
  } catch (error) {
    manualError(error);
  }
  panel.scrollIntoView({ block: "start", behavior: "smooth" });
}
function manualError(error) {
  element("manual-message").textContent = error instanceof Error ? error.message : "\u5355\u54C1\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
}
element("manual-panel").addEventListener("toggle", () => {
  if (element("manual-panel").open) void openManual();
});
element("supplement").onclick = () => {
  if (busy || !current) return;
  element("edit-entry").click();
  void openManual();
};
element("manual-upload").onchange = async () => {
  const input = element("manual-upload");
  if (busy) return;
  busy = true;
  try {
    for (const file of Array.from(input.files ?? [])) {
      if (manualPieces.length >= JOURNAL_RULES.maxItems)
        throw new Error("\u5DF2\u4FDD\u7559\u524D4\u4EF6\u5355\u54C1\uFF1B\u6700\u591A\u9009\u62E94\u4EF6\u3002");
      const garment = await importGarment(file, file.name, "\u4E0A\u8863", true);
      const image = await loadImage(garment.image);
      addManual({
        name: garment.name,
        image: garment.image,
        width: image.width,
        height: image.height
      });
    }
    element("manual-message").textContent = "\u5DF2\u6DFB\u52A0\u5E76\u9009\u4E2D\uFF0C\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u751F\u6210\u672C\u673A\u62FC\u8D34\u3002";
  } catch (error) {
    manualError(error);
  } finally {
    busy = false;
    input.value = "";
  }
};
element("manual-compose").onclick = () => void generate(true);
