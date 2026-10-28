// integrations/fitting-journal/tools/lucy-demo/web/horizontal-scroll.ts
function horizontalScroll(element2) {
  let pointer = null, start2 = 0, initial = 0, dragged = false;
  element2.addEventListener("dragstart", (event) => event.preventDefault());
  element2.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pointer = event.pointerId;
    start2 = event.clientX;
    initial = element2.scrollLeft;
    dragged = false;
  });
  element2.addEventListener("pointermove", (event) => {
    if (pointer !== event.pointerId) return;
    if (!dragged && Math.abs(event.clientX - start2) < 5) return;
    dragged = true;
    element2.setPointerCapture(event.pointerId);
    element2.scrollLeft = initial + start2 - event.clientX;
    event.preventDefault();
  });
  const end = () => {
    pointer = null;
  };
  element2.addEventListener("pointerup", end);
  element2.addEventListener("pointercancel", end);
  element2.addEventListener("lostpointercapture", end);
  element2.addEventListener("pointerleave", () => {
    if (!dragged) end();
  });
  element2.addEventListener("click", (event) => {
    if (dragged) {
      event.preventDefault();
      event.stopImmediatePropagation();
      dragged = false;
    }
  }, true);
  element2.addEventListener("wheel", (event) => {
    const previous = element2.scrollLeft;
    element2.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (element2.scrollLeft !== previous) event.preventDefault();
  }, { passive: false });
}

// integrations/fitting-journal/miniprogram/wardrobe/realtime.ts
var REALTIME_CATEGORIES = ["\u5957\u88C5", "\u4E0A\u8863", "\u88E4\u5B50", "\u5916\u5957", "\u5185\u642D", "\u978B\u5B50", "\u914D\u9970"];
function realtimeCategory(category2) {
  const aliases = {
    \u8FDE\u8863\u88D9: "\u5957\u88C5",
    \u4E0B\u88C5: "\u88E4\u5B50",
    \u978B: "\u978B\u5B50",
    \u9970\u54C1: "\u914D\u9970",
    \u5305: "\u914D\u9970"
  };
  const normalized = aliases[category2] ?? category2;
  return REALTIME_CATEGORIES.includes(normalized) ? normalized : "";
}
function selectRealtimeGarment(selected2, next) {
  if (!REALTIME_CATEGORIES.includes(next.category)) return [...selected2];
  const separates = ["\u4E0A\u8863", "\u88E4\u5B50", "\u5185\u642D"];
  return [
    ...selected2.filter(
      (item) => item.id !== next.id && item.category !== next.category && !(next.category === "\u5957\u88C5" && separates.includes(item.category)) && !(separates.includes(next.category) && item.category === "\u5957\u88C5")
    ),
    next
  ];
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
async function saveGarments(items, remove = false) {
  if (integrated) return hostWardrobe("save", items, remove);
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("garments", "readwrite");
      const store = transaction.objectStore("garments");
      for (const item of items) {
        if (remove) store.delete(item.id);
        else store.put(item);
      }
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error("\u6D4F\u89C8\u5668\u5B58\u50A8\u7A7A\u95F4\u4E0D\u8DB3\uFF0C\u672A\u4FDD\u5B58\u672C\u6B21\u8863\u7269\u3002"));
      transaction.onerror = () => reject(new Error("\u6D4F\u89C8\u5668\u8863\u6A71\u4FDD\u5B58\u5931\u8D25\u3002"));
    });
  } finally {
    db.close();
  }
}
async function importGarment(blob, name, category2, preserveAlpha = false) {
  const normalized = realtimeCategory(category2);
  if (!normalized || !["image/png", "image/jpeg", "image/webp"].includes(blob.type) || !blob.size || blob.size > 5 * 1024 * 1024)
    throw new Error("\u8BF7\u9009\u62E95MiB\u4EE5\u5185\u7684PNG\u3001JPEG\u6216WebP\u8863\u7269\u56FE\u7247\u3002");
  const url = URL.createObjectURL(blob);
  try {
    const image2 = new Image();
    image2.src = url;
    await image2.decode();
    if (!image2.naturalWidth || image2.naturalWidth * image2.naturalHeight > 25e6)
      throw new Error("\u56FE\u7247\u50CF\u7D20\u8FC7\u5927\uFF0C\u8BF7\u7F29\u5C0F\u540E\u4E0A\u4F20\u3002");
    const ratio = Math.min(1, 1200 / Math.max(image2.naturalWidth, image2.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image2.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image2.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("\u6D4F\u89C8\u5668\u65E0\u6CD5\u521B\u5EFA\u9884\u89C8\u3002");
    if (!preserveAlpha) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image2, 0, 0, canvas.width, canvas.height);
    const originalImage = canvas.toDataURL(preserveAlpha ? "image/png" : "image/jpeg", 0.9);
    const processImage = window.parent.OotripGarmentImage;
    const preparedImage = !preserveAlpha && integrated && processImage ? await processImage(originalImage) : originalImage;
    return {
      id: crypto.randomUUID(),
      name: name.replace(/\.[^.]+$/, "").slice(0, 100),
      category: normalized,
      image: preparedImage,
      originalImage,
      backgroundProcessed: preparedImage !== originalImage,
      purchased: true
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function referenceImage(selected2) {
  if (!selected2.length || selected2.length > 7) throw new Error("\u8BF7\u5148\u9009\u62E9\u8863\u7269\u3002");
  if (selected2.length === 1) return selected2[0].image;
  const images = await Promise.all(
    selected2.map(async (item) => {
      const image2 = new Image();
      image2.src = item.image;
      await image2.decode();
      return image2;
    })
  );
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("\u53C2\u8003\u56FE\u51C6\u5907\u5931\u8D25\u3002");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1024, 1024);
  const columns = selected2.length <= 4 ? 2 : 3, rows = Math.ceil(selected2.length / columns);
  images.forEach((image2, index) => {
    const w = 1024 / columns, h = 1024 / rows, ratio = Math.min((w - 32) / image2.naturalWidth, (h - 48) / image2.naturalHeight);
    context.drawImage(
      image2,
      index % columns * w + (w - image2.naturalWidth * ratio) / 2,
      Math.floor(index / columns) * h + 16,
      image2.naturalWidth * ratio,
      image2.naturalHeight * ratio
    );
    context.fillStyle = "#333";
    context.font = "18px sans-serif";
    context.fillText(
      selected2[index].category,
      index % columns * w + 16,
      Math.floor(index / columns) * h + h - 12
    );
  });
  return canvas.toDataURL("image/jpeg", 0.9);
}

// integrations/fitting-journal/tools/lucy-demo/web/portrait.ts
function portraitRegion(width, height) {
  return {
    x: width * (1 - 9 / 16 / (16 / 9)) / 2,
    y: 0,
    width: width * (9 / 16) / (16 / 9),
    height
  };
}

// integrations/fitting-journal/tools/lucy-demo/web/session-policy.ts
var TOTAL_CONNECTION_MS = 6e4;
var FIRST_FRAME_DISPLAY_MS = 3e4;
var CONNECTION_WAIT_MS = 3e4;
var TRY_ON_PROMPT = "Replace only the clothing with the garments shown in the reference image. Use the reference for garment colors, fabric and patterns only. Keep the original video person unchanged: the same face, facial features, expression, skin tone, skin texture, hairstyle, glasses, body proportions and pose. Preserve the original lighting and background. Photorealistic clothing edit only; no face replacement, makeup, beauty filter, skin smoothing or stylization. Ignore any person or face in the garment reference image.";
function firstFrameDeadline(connectionDeadline, now) {
  return Math.min(connectionDeadline, now + FIRST_FRAME_DISPLAY_MS);
}

// integrations/fitting-journal/tools/lucy-demo/web/client.ts
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error("\u9875\u9762\u7EC4\u4EF6\u7F3A\u5931\u3002");
  return node;
}
var camera = element("camera");
var output = element("output");
var preview = element("preview");
var start = element("start");
var stop = element("stop");
var capture = element("capture");
var upload = element("upload");
var files = element("files");
var consent = element("consent");
var status = element("status");
var quota = element("quota");
var nonce = document.querySelector('meta[name="lucy-experiment"]')?.content ?? "";
var wardrobe = [];
var selected = [];
var category = "\u4E0A\u8863";
var stream = null;
var frame = null;
var busy = false;
var running = false;
var available = false;
var firstFrame = false;
var generation = 0;
var deadline = 0;
var timeout = 0;
var interval = 0;
var help = element("help");
var wardrobeToggle = element("toggle-wardrobe");
wardrobeToggle.onclick = () => {
  const collapsed = element("wardrobe-panel").hidden = !element("wardrobe-panel").hidden;
  document.querySelector(".workspace")?.classList.toggle("wardrobe-collapsed", collapsed);
  wardrobeToggle.setAttribute("aria-expanded", String(!collapsed));
  wardrobeToggle.textContent = collapsed ? "\u2039 \u5C55\u5F00\u9009\u8863" : "\u6536\u8D77\u9009\u8863 \u203A";
};
element("open-help").onclick = () => help.showModal();
element("close-help").onclick = () => help.close();
function controls() {
  preview.disabled = busy || running || !!stream;
  upload.disabled = busy || running;
  files.disabled = busy || running;
  start.disabled = busy || running;
  stop.disabled = !stream && !busy && !running;
  capture.disabled = !firstFrame || !running;
  consent.disabled = busy || running;
  element("clear-selection").disabled = busy || running;
  document.querySelectorAll(
    "#categories button, .garment button, .selected-item button"
  ).forEach((button) => {
    button.disabled = busy || running;
  });
}
function image(item) {
  const node = new Image();
  node.src = item.image;
  node.alt = item.name;
  return node;
}
function message(text) {
  status.textContent = text;
}
function invalidateLook() {
  consent.checked = false;
}
function render() {
  element("closet-count").textContent = `${wardrobe.length} \u4EF6\u5355\u54C1`;
  element("category-name").textContent = category;
  element("selection-count").textContent = String(selected.length);
  element("look-name").textContent = selected.length ? selected.map((item) => item.category).join(" / ") : "\u81EA\u7136\u547C\u5438\uFF0C\u8F7B\u677E\u51FA\u53D1\u3002";
  const categories = element("categories");
  categories.replaceChildren();
  for (const name of REALTIME_CATEGORIES) {
    const button = document.createElement("button");
    button.textContent = name;
    button.className = name === category ? "active" : "";
    button.setAttribute("aria-pressed", String(name === category));
    button.onclick = () => {
      if (running || busy) return;
      category = name;
      render();
    };
    categories.append(button);
  }
  const gallery = element("gallery");
  gallery.replaceChildren();
  for (const item of wardrobe.filter((entry) => entry.category === category)) {
    const wrapper = document.createElement("div");
    wrapper.className = "garment";
    const tile = document.createElement("button"), label = document.createElement("p"), remove = document.createElement("button");
    const checked = selected.some((entry) => entry.id === item.id);
    tile.className = `garment-tile${checked ? " selected" : ""}`;
    tile.setAttribute("aria-pressed", String(checked));
    tile.setAttribute("aria-label", `\u9009\u62E9${item.name}`);
    tile.append(image(item));
    tile.onclick = () => {
      if (busy || running) return;
      selected = selectRealtimeGarment(selected, item);
      invalidateLook();
      render();
      message("\u8863\u7269\u5DF2\u9009\u597D\uFF1B\u540C\u7C7B\u81EA\u52A8\u66FF\u6362\uFF0C\u5957\u88C5\u4E0E\u4E0A\u8863\u3001\u88E4\u5B50\u3001\u5185\u642D\u4E92\u65A5\u3002");
    };
    label.className = "garment-label";
    label.textContent = item.name;
    remove.className = "delete";
    remove.textContent = "\xD7";
    remove.setAttribute("aria-label", `\u4ECE\u6D4F\u89C8\u5668\u8863\u6A71\u5220\u9664${item.name}`);
    remove.onclick = () => {
      if (busy || running || !window.confirm(`\u4ECE\u6D4F\u89C8\u5668\u8863\u6A71\u5220\u9664\u201C${item.name}\u201D\uFF1F`)) return;
      busy = true;
      controls();
      void saveGarments([item], true).then(() => {
        wardrobe = wardrobe.filter((entry) => entry.id !== item.id);
        selected = selected.filter((entry) => entry.id !== item.id);
        invalidateLook();
      }).catch(() => message("\u5220\u9664\u5931\u8D25\uFF0C\u8863\u7269\u5DF2\u4FDD\u7559\u3002")).finally(() => {
        busy = false;
        render();
      });
    };
    wrapper.append(tile, label);
    if (!item.id.startsWith("saved-outfit-")) wrapper.append(remove);
    gallery.append(wrapper);
  }
  if (!gallery.children.length) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    const icon = document.createElement("strong");
    icon.textContent = "\uFF0B";
    const caption = document.createElement("p");
    caption.textContent = `\u8FD8\u6CA1\u6709${category}\uFF0C\u70B9\u51FB\u4E0A\u4F20\u6DFB\u52A0`;
    empty.append(icon, caption);
    gallery.append(empty);
  }
  const selection = element("selected");
  selection.replaceChildren();
  for (const item of selected) {
    const wrapper = document.createElement("div");
    wrapper.className = "selected-item";
    const label = document.createElement("span");
    label.textContent = item.category;
    const remove = document.createElement("button");
    remove.textContent = "\xD7";
    remove.setAttribute("aria-label", `\u53D6\u6D88${item.name}`);
    remove.onclick = () => {
      if (busy || running) return;
      selected = selected.filter((entry) => entry.id !== item.id);
      invalidateLook();
      render();
    };
    wrapper.append(image(item), label, remove);
    selection.append(wrapper);
  }
  if (!selected.length) {
    const empty = document.createElement("p");
    empty.textContent = "\u4ECE\u53F3\u4FA7\u8863\u6A71\u9009\u62E9\uFF0C\u6216\u76F4\u63A5\u4E0A\u4F20\u559C\u6B22\u7684\u8863\u7269\u3002";
    selection.append(empty);
  }
  controls();
}
async function configuration() {
  try {
    const response = await fetch("/experiment/status", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    available = data.configured && data.available;
    quota.textContent = !data.configured ? "\u5C1A\u672A\u914D\u7F6E Decart \u5BC6\u94A5\uFF0C\u672C\u673A\u6444\u50CF\u5934\u4E0E\u9009\u8863\u4ECD\u53EF\u6F14\u793A\u3002" : data.testBudget?.remaining === 0 ? `\u5B9E\u65F6\u8BD5\u8863\u6D4B\u8BD5\u6B21\u6570\u5DF2\u7528\u5B8C\uFF08${data.testBudget.limit}/${data.testBudget.limit}\uFF09\uFF0C\u9700\u914D\u7F6E\u65B0\u7684\u53EF\u7528\u989D\u5EA6\u540E\u624D\u80FD\u7EE7\u7EED\uFF1B\u672C\u673A\u76F8\u673A\u4ECD\u53EF\u4F7F\u7528\u3002` : data.testBudget ? `\u73B0\u6709\u6D4B\u8BD5\u6279\u6B21\u5269\u4F59 ${data.testBudget.remaining} / ${data.testBudget.limit} \u6B21 \xB7 \u6253\u5F00\u76F8\u673A\u4E0D\u6D88\u8017\u989D\u5EA6` : "\u670D\u52A1\u5DF2\u8FDE\u63A5";
    element("status-dot").classList.toggle("ready", available);
  } catch {
    available = false;
    quota.textContent = "\u8BD5\u7A7F\u670D\u52A1\u672A\u8FDE\u63A5\uFF0C\u8BF7\u68C0\u67E5\u6F14\u793A\u670D\u52A1\u7A97\u53E3\u3002";
  }
  controls();
}
function finish(text, refresh = true) {
  generation++;
  window.clearTimeout(timeout);
  window.clearInterval(interval);
  timeout = 0;
  interval = 0;
  deadline = 0;
  frame?.remove();
  frame = null;
  output.replaceChildren();
  output.hidden = true;
  const previous = stream;
  stream = null;
  previous?.getTracks().forEach((track) => track.stop());
  camera.srcObject = null;
  camera.hidden = true;
  camera.classList.remove("inset-camera");
  busy = false;
  running = false;
  firstFrame = false;
  consent.checked = false;
  element("empty-camera").hidden = false;
  element("mirror-copy").hidden = false;
  element("view-label").textContent = "\u8BD5\u8863\u955C\u5DF2\u5173\u95ED";
  element("countdown").textContent = "LIVE FITTING";
  message(text);
  controls();
  if (refresh) void configuration();
}
function deadlineReached() {
  finish(
    firstFrame ? "\u672C\u6B21\u8BD5\u7A7F\u5DF2\u5230\u65F6\u5E76\u5173\u95ED\u76F8\u673A\uFF0C\u53EF\u4EE5\u9009\u62E9\u4E0B\u4E00\u5957\u3002" : "\u672C\u6B21\u8FDE\u63A5\u5DF2\u5230\u65F6\uFF0C\u5C1A\u672A\u663E\u793A\u9996\u5E27\uFF1B\u672A\u81EA\u52A8\u91CD\u8BD5\u3002"
  );
}
upload.onclick = () => files.click();
files.onchange = () => {
  if (busy || running || !files.files?.length) return;
  const chosen = [...files.files].slice(0, 30), chosenCategory = category, version = generation;
  files.value = "";
  busy = true;
  controls();
  message("\u6B63\u5728\u672C\u673A\u51C6\u5907\u8863\u7269\u56FE\u7247\u2026");
  void (async () => {
    let successes = 0, failures = 0;
    for (const file of chosen) {
      try {
        const item = await importGarment(file, file.name, chosenCategory);
        if (version !== generation) return;
        await saveGarments([item]);
        if (version !== generation) return;
        wardrobe.push(item);
        selected = selectRealtimeGarment(selected, item);
        successes++;
      } catch {
        failures++;
      }
    }
    if (version !== generation) return;
    busy = false;
    invalidateLook();
    render();
    message(
      `\u5DF2\u6DFB\u52A0${successes}\u4EF6${chosenCategory}\uFF0C${failures ? `${failures}\u4EF6\u65E0\u6CD5\u8BFB\u53D6\u6216\u4FDD\u5B58\u3002` : "\u6700\u540E\u4E00\u4EF6\u5DF2\u9009\u4E2D\uFF0C\u53EF\u70B9\u51FB\u7F29\u7565\u56FE\u5207\u6362\u3002"}`
    );
  })();
};
element("clear-selection").onclick = () => {
  if (running || busy) return;
  selected = [];
  invalidateLook();
  render();
};
preview.onclick = () => {
  if (running || busy || stream) return;
  const version = ++generation;
  busy = true;
  controls();
  message("\u6B63\u5728\u6253\u5F00\u7535\u8111\u6444\u50CF\u5934\uFF0C\u4E0D\u8C03\u7528AI\u2026");
  void (async () => {
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error();
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      if (version !== generation) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = next;
      camera.srcObject = next;
      camera.hidden = false;
      camera.classList.remove("inset-camera");
      await camera.play();
      if (version !== generation) return;
      next.getVideoTracks().forEach(
        (track) => track.addEventListener("ended", () => {
          if (stream === next) finish("\u6444\u50CF\u5934\u5DF2\u505C\u6B62\uFF0C\u8FDE\u63A5\u5DF2\u5173\u95ED\u3002");
        })
      );
      busy = false;
      element("empty-camera").hidden = true;
      element("mirror-copy").hidden = true;
      element("view-label").textContent = "\u672C\u673A\u6444\u50CF\u5934\u9884\u89C8 \xB7 \u672A\u8C03\u7528AI";
      message("\u76F8\u673A\u5DF2\u5C31\u7EEA\uFF0C\u8BA9\u8EAB\u4F53\u5B8C\u6574\u5165\u955C\uFF0C\u786E\u8BA4\u9009\u8863\u540E\u5F00\u59CB\u3002");
      controls();
    } catch {
      if (version === generation)
        finish("\u76F8\u673A\u672A\u80FD\u6253\u5F00\uFF0C\u8BF7\u5141\u8BB8Chrome\u6444\u50CF\u5934\u6743\u9650\u5E76\u5173\u95ED\u5176\u4ED6\u5360\u7528\u76F8\u673A\u7684\u5E94\u7528\u3002");
    }
  })();
};
start.onclick = () => {
  if (busy || running) return;
  const reason = !selected.length ? "\u8BF7\u5148\u4E0A\u4F20\u6216\u9009\u62E9\u8BD5\u7A7F\u8863\u7269\u3002" : !stream ? "\u8BF7\u5148\u5F00\u542F\u6444\u50CF\u5934\u9884\u89C8\u3002" : !available ? quota.textContent || "\u5B9E\u65F6\u8BD5\u8863\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u8FDE\u63A5\u3002" : !consent.checked ? "\u8BF7\u5148\u52FE\u9009\u672C\u6B21\u5904\u7406\u4E0E\u989D\u5EA6\u6D88\u8017\u540C\u610F\u3002" : "";
  if (reason) {
    message(reason);
    return;
  }
  const currentStream = stream;
  const version = ++generation;
  busy = true;
  running = true;
  firstFrame = false;
  controls();
  message("\u6B63\u5728\u51C6\u5907\u6240\u9009\u8863\u7269\u548C\u5B9E\u65F6\u89C6\u9891\u8FDE\u63A5\u2026");
  timeout = window.setTimeout(() => finish("\u51C6\u5907\u8FDE\u63A5\u8D85\u65F6\uFF0C\u5DF2\u5173\u95ED\u6444\u50CF\u5934\uFF1B\u672A\u81EA\u52A8\u91CD\u8BD5\u3002"), 2e4);
  void (async () => {
    try {
      const reference = await referenceImage([...selected]);
      if (version !== generation) return;
      const session = document.createElement("iframe");
      session.title = "Lucy\u5B9E\u65F6\u8BD5\u7A7F\u753B\u9762";
      session.src = "/session.html";
      frame = session;
      session.addEventListener(
        "load",
        () => {
          if (version !== generation || frame !== session) return;
          const target = session.contentWindow;
          if (!target?.runLucy) {
            finish("\u5B9E\u65F6\u89C6\u9891\u6A21\u5757\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u3002");
            return;
          }
          target.runLucy({
            stream: currentStream,
            image: reference,
            nonce,
            prompt: TRY_ON_PROMPT
          });
        },
        { once: true }
      );
      output.replaceChildren(session);
      output.hidden = false;
      camera.classList.add("inset-camera");
      element("view-label").textContent = "\u6B63\u5728\u8FDE\u63A5Lucy \xB7 \u672C\u673A\u53D6\u666F\u89C1\u5C0F\u7A97";
    } catch {
      if (version === generation) finish("\u8863\u7269\u53C2\u8003\u56FE\u65E0\u6CD5\u51C6\u5907\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u56FE\u7247\u3002");
    }
  })();
};
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "phase" && typeof data.message === "string") message(data.message);
  else if (data.type === "dial" && !deadline) {
    deadline = performance.now() + TOTAL_CONNECTION_MS;
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => finish("\u7B49\u5F85\u8BD5\u7A7F\u753B\u9762\u8D85\u65F6\uFF0C\u5DF2\u7ED3\u675F\u8FDE\u63A5\uFF1B\u672A\u81EA\u52A8\u91CD\u8BD5\u3002"), CONNECTION_WAIT_MS);
    interval = window.setInterval(() => {
      element("countdown").textContent = `${Math.max(0, Math.ceil((deadline - performance.now()) / 1e3))}s REMAINING`;
    }, 100);
    void configuration();
  } else if (data.type === "playing") {
    if (!firstFrame) {
      firstFrame = true;
      deadline = firstFrameDeadline(
        deadline || performance.now() + TOTAL_CONNECTION_MS,
        performance.now()
      );
      window.clearTimeout(timeout);
      timeout = window.setTimeout(deadlineReached, Math.max(0, deadline - performance.now()));
    }
    element("view-label").textContent = "LUCY \xB7 AI\u5B9E\u65F6\u8BD5\u7A7F";
    message("\u5B9E\u65F6\u8BD5\u7A7F\u4E2D\uFF0C\u53EF\u8F7B\u5FAE\u8F6C\u8EAB\uFF1B\u5230\u65F6\u81EA\u52A8\u7ED3\u675F\u3002");
    controls();
  } else if (data.type === "failure" || data.type === "ended")
    finish(typeof data.message === "string" ? data.message : "\u672C\u6B21\u8FDE\u63A5\u5DF2\u7ED3\u675F\uFF0C\u672A\u81EA\u52A8\u91CD\u8BD5\u3002");
});
stop.onclick = () => finish("\u5DF2\u4E3B\u52A8\u7ED3\u675F\uFF0C\u6444\u50CF\u5934\u5DF2\u5173\u95ED\u3002");
capture.onclick = () => {
  if (!running || !firstFrame) return;
  try {
    const video = frame?.contentDocument?.querySelector("video");
    if (!video?.videoWidth) throw new Error();
    const canvas = document.createElement("canvas");
    const region = portraitRegion(video.videoWidth, video.videoHeight);
    const cropWidth = region.width;
    const cropHeight = region.height;
    canvas.width = Math.max(1, Math.round(cropWidth));
    canvas.height = Math.max(1, Math.round(cropHeight));
    const context = canvas.getContext("2d");
    if (!context) throw new Error();
    context.drawImage(
      video,
      region.x,
      region.y,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const link = document.createElement("a");
    link.download = `OOTRIP-\u8BD5\u7A7F-${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.click();
    message("\u5DF2\u6309\u4F60\u7684\u64CD\u4F5C\u4E0B\u8F7D\u5F53\u524D\u8BD5\u7A7F\u753B\u9762\u3002");
  } catch {
    message("\u5F53\u524D\u753B\u9762\u5C1A\u4E0D\u80FD\u4FDD\u5B58\uFF0C\u8BF7\u7B49\u5F85\u8BD5\u7A7F\u89C6\u9891\u663E\u793A\u540E\u91CD\u8BD5\u3002");
  }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (busy || running || stream))
    finish("\u9875\u9762\u5DF2\u5207\u5230\u540E\u53F0\uFF0C\u5DF2\u7ED3\u675F\u5E76\u5173\u95ED\u6444\u50CF\u5934\u3002");
});
window.addEventListener("pagehide", () => finish("\u9875\u9762\u5DF2\u5173\u95ED\u3002", false));
window.addEventListener("offline", () => {
  if (stream || running) finish("\u7F51\u7EDC\u5DF2\u65AD\u5F00\uFF0C\u5DF2\u5173\u95ED\u6444\u50CF\u5934\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8FDE\u3002", false);
});
void readWardrobe().then((items) => {
  wardrobe = items;
  render();
}).catch(() => {
  render();
  message("\u6D4F\u89C8\u5668\u8863\u6A71\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u4F7F\u7528\u666E\u901A\u6D4F\u89C8\u7A97\u53E3\u540E\u91CD\u8BD5\u3002");
});
render();
void configuration();
window.addEventListener("message", (event) => {
  if (event.source === window.parent && event.origin === location.origin && event.data?.type === "ootrip:module-close") finish("\u5DF2\u8FD4\u56DE\u8863\u6A71\uFF0C\u6444\u50CF\u5934\u5DF2\u5173\u95ED\u3002", false);
});
element("categories").addEventListener("click", () => document.querySelector(".wardrobe")?.classList.add("show-items"));
var categoryBack = document.createElement("button");
categoryBack.className = "quiet";
categoryBack.textContent = "\u2039 \u5206\u7C7B";
categoryBack.onclick = () => document.querySelector(".wardrobe")?.classList.remove("show-items");
document.querySelector(".gallery-top")?.prepend(categoryBack);
var selectedPanel = document.querySelector(".selection");
if (selectedPanel) document.querySelector(".control-bar")?.prepend(selectedPanel);
horizontalScroll(document.getElementById("selected"));
