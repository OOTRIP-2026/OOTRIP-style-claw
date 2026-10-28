// integrations/fitting-journal/tools/lucy-demo/web/horizontal-scroll.ts
function horizontalScroll(element) {
  let pointer = null, start = 0, initial = 0, dragged = false;
  element.addEventListener("dragstart", (event) => event.preventDefault());
  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pointer = event.pointerId;
    start = event.clientX;
    initial = element.scrollLeft;
    dragged = false;
  });
  element.addEventListener("pointermove", (event) => {
    if (pointer !== event.pointerId) return;
    if (!dragged && Math.abs(event.clientX - start) < 5) return;
    dragged = true;
    element.setPointerCapture(event.pointerId);
    element.scrollLeft = initial + start - event.clientX;
    event.preventDefault();
  });
  const end = () => {
    pointer = null;
  };
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("lostpointercapture", end);
  element.addEventListener("pointerleave", () => {
    if (!dragged) end();
  });
  element.addEventListener("click", (event) => {
    if (dragged) {
      event.preventDefault();
      event.stopImmediatePropagation();
      dragged = false;
    }
  }, true);
  element.addEventListener("wheel", (event) => {
    const previous = element.scrollLeft;
    element.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (element.scrollLeft !== previous) event.preventDefault();
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
function hostWardrobe(method, items2, remove = false) {
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
    window.parent.postMessage({ type: "ootrip:wardrobe-rpc", id, method, items: items2, remove }, location.origin);
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
async function saveGarments(items2, remove = false) {
  if (integrated) return hostWardrobe("save", items2, remove);
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("garments", "readwrite");
      const store = transaction.objectStore("garments");
      for (const item of items2) {
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
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 25e6)
      throw new Error("\u56FE\u7247\u50CF\u7D20\u8FC7\u5927\uFF0C\u8BF7\u7F29\u5C0F\u540E\u4E0A\u4F20\u3002");
    const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("\u6D4F\u89C8\u5668\u65E0\u6CD5\u521B\u5EFA\u9884\u89C8\u3002");
    if (!preserveAlpha) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
      const image = new Image();
      image.src = item.image;
      await image.decode();
      return image;
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
  images.forEach((image, index) => {
    const w = 1024 / columns, h = 1024 / rows, ratio = Math.min((w - 32) / image.naturalWidth, (h - 48) / image.naturalHeight);
    context.drawImage(
      image,
      index % columns * w + (w - image.naturalWidth * ratio) / 2,
      Math.floor(index / columns) * h + 16,
      image.naturalWidth * ratio,
      image.naturalHeight * ratio
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
async function readCanvasSelection() {
  return integrated ? hostWardrobe("selection") : [];
}

// integrations/fitting-journal/tools/lucy-demo/web/photo.ts
async function apiFetch(route, options = {}) {
  const headers = new Headers(options.headers);
  if (options.method === "POST") headers.set("x-lucy-experiment", document.querySelector('meta[name="lucy-experiment"]').content);
  return fetch(route, { ...options, headers });
}
var el = (id) => document.getElementById(id);
var person = "";
var result = "";
var items = [];
var selected = [];
var category = "\u4E0A\u8863";
var configured = false;
var busy = false;
var closed = false;
var selectedModelShape = "";
function presetFittingPreview(shape, garments) {
  if (garments.length !== 1) return "";
  const presets = {
    "hourglass:saved-outfit-b227acfbd0ead44f": "gingham-hourglass-hd-v2.png",
    "straight:saved-outfit-b227acfbd0ead44f": "gingham-straight-hd-v2.png",
    "pear:saved-outfit-b665af21d10cf54d": "khaki-pear-hd-v1.png",
    "pear:saved-outfit-86d36292d0fbed4c": "cream-pear-hd-v1.png"
  };
  const asset = presets[shape + ":" + garments[0]?.id];
  if (!asset) return "";
  const root = location.pathname === "/photo-screen" ? "/app/assets/fitting-previews/" : "../assets/fitting-previews/";
  return root + asset;
}
function applyPresetFittingPreview() {
  if (result || !person) return;
  const preview = presetFittingPreview(selectedModelShape, selected);
  if (!preview) return;
  result = preview;
  el("result-preview").classList.add("builtin-preset");
  el("result-preview").src = preview;
  el("result-preview").alt = (selectedModelShape === "pear" ? "\u68A8\u578B" : selectedModelShape === "hourglass" ? "\u6C99\u6F0F\u578B" : "H\u578B") + "\u5DF2\u9009\u5957\u88C5\u53C2\u8003\u6548\u679C";
  el("result-preview").hidden = false;
  el("person-preview").hidden = true;
  el("original").textContent = "\u67E5\u770B\u539F\u56FE";
  el("original").hidden = false;
  el("download-photo").disabled = false;
  status("\u5DF2\u5C55\u793A\u8FD9\u5957\u642D\u914D\u5BF9\u5E94\u8EAB\u578B\u7684\u9884\u8BBE\u53C2\u8003\u6548\u679C\u3002");
}
var controller;
var status = (message) => {
  el("photo-status").textContent = message;
};
function update() {
  el("photo-start").disabled = busy || !configured || !person || !selected.length || !el("photo-consent").checked;
  el("person-file").disabled = busy;
  el("photo-consent").disabled = busy;
}
function clearResult() {
  result = "";
  el("person-preview").hidden = !person;
  el("original").textContent = "\u67E5\u770B\u539F\u56FE";
  el("result-preview").hidden = true;
  el("result-preview").classList.remove("builtin-preset");
  el("original").hidden = true;
  el("download-photo").disabled = true;
  applyPresetFittingPreview();
}
function renderSelection() {
  const list = el("photo-selection");
  list.replaceChildren();
  if (!selected.length) {
    const hint = document.createElement("span");
    hint.textContent = "\u5C1A\u672A\u9009\u62E9\u8863\u7269\uFF0C\u70B9\u51FB\u53F3\u4FA7\u5206\u7C7B\u9009\u8863";
    list.append(hint);
  }
  for (const garment of selected) {
    const button = document.createElement("button"), img = document.createElement("img"), label = document.createElement("span");
    button.type = "button";
    button.setAttribute("aria-label", "\u53D6\u6D88\u9009\u62E9" + garment.name);
    img.src = garment.image;
    img.alt = garment.name;
    label.textContent = garment.category + " \xD7";
    button.append(img, label);
    button.onclick = () => {
      if (busy) return;
      selected = selected.filter((x) => x.id !== garment.id);
      el("photo-consent").checked = false;
      clearResult();
      render();
    };
    list.append(button);
  }
}
function render() {
  renderSelection();
  el("photo-category-title").textContent = category;
  el("photo-categories").replaceChildren();
  el("photo-garments").replaceChildren();
  for (const value of REALTIME_CATEGORIES) {
    const b = document.createElement("button");
    b.textContent = value;
    b.className = value === category ? "active" : "";
    b.onclick = () => {
      if (busy) return;
      category = value;
      photoClosetView(true);
      render();
    };
    el("photo-categories").append(b);
  }
  for (const garment of items.filter((x) => x.category === category)) {
    const b = document.createElement("button"), img = document.createElement("img");
    img.src = garment.image;
    img.alt = garment.name;
    b.className = selected.some((x) => x.id === garment.id) ? "selected" : "";
    b.setAttribute("aria-pressed", String(b.className === "selected"));
    b.append(img, document.createTextNode(garment.name));
    b.onclick = () => {
      if (busy) return;
      selected = selected.some((x) => x.id === garment.id) ? selected.filter((x) => x.id !== garment.id) : selectRealtimeGarment(selected, garment);
      el("photo-consent").checked = false;
      clearResult();
      render();
    };
    el("photo-garments").append(b);
  }
  if (!el("photo-garments").children.length) {
    const p = document.createElement("p");
    p.className = "empty-category";
    p.textContent = "\u8FD8\u6CA1\u6709" + category + "\uFF0C\u53EF\u70B9\u51FB\u4E0A\u65B9\u4E0A\u4F20";
    el("photo-garments").append(p);
  }
  el("photo-selected").textContent = selected.length ? "\u672C\u6B21\u8BD5\u7A7F\uFF1A" + selected.map((x) => x.name).join("\u3001") : "\u8BF7\u4ECE\u8863\u6A71\u9009\u62E9\u8863\u7269\uFF1B\u8863\u6A71\u4E0A\u4F20\u7684\u8863\u7269\u4F1A\u5728\u8FD9\u91CC\u540C\u6B65\u663E\u793A\u3002";
  update();
}
el("person-file").onchange = async () => {
  const input = el("person-file"), file = input.files?.[0];
  if (!file || busy) return;
  busy = true;
  update();
  try {
    person = (await importGarment(file, file.name, "\u4E0A\u8863", true)).image;
    selectedModelShape = "";
    el("person-preview").classList.remove("builtin-model");
    el("person-preview").src = person;
    el("person-preview").hidden = false;
    el("empty").hidden = true;
    clearResult();
    el("photo-consent").checked = false;
  } catch (error) {
    status(error instanceof Error ? error.message : "\u7167\u7247\u5904\u7406\u5931\u8D25");
  } finally {
    busy = false;
    input.value = "";
    update();
  }
};
el("photo-consent").onchange = update;
el("photo-start").onclick = async () => {
  if (busy || !configured || !person || !selected.length || !el("photo-consent").checked) return;
  busy = true;
  controller = new AbortController();
  update();
  el("photo-status").closest("details").open = true;
  status("AI\u6B63\u5728\u4E3A\u4F60\u66F4\u6362\u8863\u670D\uFF0C\u8BF7\u7A0D\u5019\u2026");
  try {
    const garments = await referenceImage(selected);
    const response = await apiFetch("/fitting/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: person, garments, consent: true, requestId: crypto.randomUUID() }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25e4)]) });
    const body = await response.json();
    if (!response.ok || !body.image?.startsWith("data:image/png;base64,")) throw Error(body.message ?? "\u8BD5\u8863\u7ED3\u679C\u65E0\u6548");
    if (closed) return;
    result = body.image;
    el("result-preview").src = result;
    el("result-preview").hidden = false;
    el("person-preview").hidden = true;
    el("original").textContent = "\u67E5\u770B\u539F\u56FE";
    el("original").hidden = false;
    el("download-photo").disabled = false;
    status("\u7167\u7247\u8BD5\u8863\u5DF2\u5B8C\u6210\uFF0C\u53EF\u5207\u6362\u539F\u56FE\u6216\u4FDD\u5B58\u6548\u679C\u3002");
  } catch (error) {
    if (!closed) status(error instanceof Error ? error.message : "\u7167\u7247\u8BD5\u8863\u5931\u8D25\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8BD5\u3002");
  } finally {
    busy = false;
    el("photo-consent").checked = false;
    update();
  }
};
el("original").onclick = () => {
  el("result-preview").hidden = !el("result-preview").hidden;
  el("person-preview").hidden = !el("result-preview").hidden;
  el("original").textContent = el("result-preview").hidden ? "\u67E5\u770B\u8BD5\u8863" : "\u67E5\u770B\u539F\u56FE";
};
el("download-photo").onclick = () => {
  if (!result) return;
  const a = document.createElement("a");
  a.href = result;
  a.download = "OOTRIP-photo-fitting.png";
  a.click();
};
function close() {
  closed = true;
  controller?.abort();
}
window.addEventListener("pagehide", close);
window.addEventListener("message", (e) => {
  if (e.source === parent && (location.protocol === "file:" ? ["null", "file://"].includes(e.origin) : e.origin === location.origin) && e.data?.type === "ootrip:module-close") close();
});
void Promise.all([readWardrobe(), readCanvasSelection()]).then(([data, initial]) => {
  items = [...data, ...initial];
  for (const item of initial) selected = selectRealtimeGarment(selected, item);
  render();
}).catch(() => status("\u8863\u6A71\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u8FD4\u56DE\u91CD\u8BD5\u3002"));
void apiFetch("/fitting/photo/status").then((r) => r.json()).then((data) => {
  configured = data.configured;
  status(data.message);
  update();
}).catch((error) => {
  status(error instanceof Error ? error.message : "AI\u670D\u52A1\u5C1A\u672A\u8FDE\u63A5\uFF0C\u7167\u7247\u548C\u9009\u8863\u4ECD\u53EF\u9884\u89C8\u3002");
  update();
});
render();
function photoClosetView(detail) {
  el("photo-wardrobe").dataset.view = detail ? "items" : "categories";
  el("photo-toggle").hidden = !detail;
  el("photo-toggle").setAttribute("aria-expanded", String(detail));
}
el("photo-toggle").onclick = () => photoClosetView(false);
el("photo-category-back").onclick = () => photoClosetView(false);
var personDialog = document.createElement("dialog");
personDialog.className = "person-picker";
personDialog.setAttribute("aria-labelledby", "person-picker-title");
personDialog.innerHTML = '<button type="button" class="person-picker-close" data-person-close aria-label="\u5173\u95ED\u4EBA\u7269\u9009\u62E9" hidden>\xD7</button><h2 id="person-picker-title">\u9009\u62E9\u8BD5\u8863\u4EBA\u7269</h2><div class="person-picker-actions"><button type="button" data-person-all>\u5173\u95ED</button><button type="button" data-person-upload>\u4E0A\u4F20\u5168\u8EAB\u7167</button><button type="button" data-person-model>\u9009\u62E9AI\u6A21\u7279</button></div><section class="person-models" hidden><p>\u9009\u62E9\u8EAB\u578B\uFF0C\u5DE6\u53F3\u6ED1\u52A8\u67E5\u770B\u66F4\u591A</p><div class="person-model-track" tabindex="0" aria-label="\u9009\u62E9\u6A21\u7279\u8EAB\u578B\uFF0C\u53EF\u5DE6\u53F3\u6ED1\u52A8"></div><p class="person-model-status" role="status"></p></section>';
document.body.append(personDialog);
var personReturnFocus = null;
function setPersonPickerView(models) {
  personDialog.dataset.view = models ? "models" : "choices";
  personDialog.querySelector(".person-models").hidden = !models;
  personDialog.querySelector(".person-picker-actions").hidden = models;
  personDialog.querySelector("[data-person-close]").hidden = !models;
  if (models) requestAnimationFrame(() => {
    modelTrack.scrollLeft = modelStep() * 5;
    updateModelCardMotion();
  });
}
function openPersonPicker() {
  if (busy) return;
  personReturnFocus = document.activeElement;
  setPersonPickerView(false);
  personDialog.showModal();
}
function closePersonPicker() {
  personDialog.close();
  personReturnFocus?.focus();
}
personDialog.querySelector("[data-person-close]").onclick = closePersonPicker;
personDialog.querySelector("[data-person-upload]").onclick = () => {
  closePersonPicker();
  el("person-file").click();
};
personDialog.querySelector("[data-person-all]").onclick = closePersonPicker;
personDialog.querySelector("[data-person-model]").onclick = () => {
  setPersonPickerView(true);
  personDialog.querySelector("[data-person-close]").focus();
};
personDialog.addEventListener("click", (event) => {
  if (event.target === personDialog) {
    const rect = personDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePersonPicker();
  }
});
var modelTrack = personDialog.querySelector(".person-model-track");
var modelRoot = location.pathname === "/photo-screen" ? "/app/assets/fitting-models/" : "../assets/fitting-models/";
async function modelPreviewImage(blob, shape) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("\u6A21\u7279\u56FE\u7247\u8BFB\u53D6\u5931\u8D25"));
    reader.readAsDataURL(blob);
  });
  if (!["apple", "pear"].includes(shape)) return source;
  const image = new Image();
  image.src = source;
  await image.decode();
  const stage = el("person-preview").parentElement.getBoundingClientRect(), width = image.naturalWidth, height = image.naturalHeight;
  const boundsRatio = stage.width > 0 && stage.height > 0 ? stage.height * 0.948 / (stage.width * 0.527) : 868 / 249;
  const targetHeight = Math.max(height, Math.round(width * boundsRatio));
  if (targetHeight === height) return source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw Error("\u65E0\u6CD5\u8C03\u6574\u6A21\u7279\u9884\u89C8");
  const legStart = Math.round(height * 0.56), shoeStart = Math.round(height * 0.88), shoeHeight = height - shoeStart;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, legStart, 0, 0, width, legStart);
  context.drawImage(image, 0, legStart, width, shoeStart - legStart, 0, legStart, width, targetHeight - legStart - shoeHeight);
  context.drawImage(image, 0, shoeStart, width, shoeHeight, 0, targetHeight - shoeHeight, width, shoeHeight);
  return canvas.toDataURL("image/png");
}
for (const [file, name] of [["apple", "\u82F9\u679C\u578B"], ["hourglass", "\u6C99\u6F0F\u578B"], ["pear", "\u68A8\u578B"], ["straight", "H\u578B"], ["inverted", "\u5012\u4E09\u89D2\u578B"]]) {
  const button = document.createElement("button"), image = document.createElement("img"), label = document.createElement("span");
  button.type = "button";
  button.className = "person-model-card";
  image.src = modelRoot + file + "-hd-v3.png";
  image.alt = name + "\u8BD5\u8863\u6A21\u7279";
  image.draggable = false;
  label.textContent = name;
  button.append(image, label);
  button.onclick = async () => {
    if (busy) return;
    busy = true;
    update();
    modelTrack.querySelectorAll("button").forEach((b) => b.disabled = true);
    const feedback = personDialog.querySelector(".person-model-status");
    feedback.textContent = "\u6B63\u5728\u8F7D\u5165\u6A21\u7279\u2026";
    try {
      const response = await fetch(modelRoot + file + "-hd-v3.png");
      if (!response.ok) throw Error("\u6A21\u7279\u56FE\u7247\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
      const blob = await response.blob();
      person = await modelPreviewImage(blob, file);
      selectedModelShape = file;
      const preview = el("person-preview");
      preview.classList.add("builtin-model");
      preview.src = person;
      preview.alt = name + "\u8BD5\u8863\u6A21\u7279";
      el("empty").hidden = true;
      clearResult();
      el("photo-consent").checked = false;
      closePersonPicker();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : "\u6A21\u7279\u8F7D\u5165\u5931\u8D25";
    } finally {
      busy = false;
      modelTrack.querySelectorAll("button").forEach((b) => b.disabled = false);
      if (!personDialog.open) feedback.textContent = "";
      update();
    }
  };
  modelTrack.append(button);
}
var originalModelCards = [...modelTrack.querySelectorAll(".person-model-card")];
function cloneModelCards() {
  return originalModelCards.map((original) => {
    const clone = original.cloneNode(true);
    clone.onclick = original.onclick;
    return clone;
  });
}
modelTrack.prepend(...cloneModelCards());
modelTrack.append(...cloneModelCards());
function modelStep() {
  return modelTrack.firstElementChild?.offsetWidth + 14;
}
var modelLoopTimer;
function settleModelLoop() {
  if (!personDialog.open || personDialog.dataset.view !== "models") return;
  const step = modelStep(), index = Math.round(modelTrack.scrollLeft / step);
  if (index < 5 || index >= 10) {
    const target = ((index % 5 + 5) % 5 + 5) * step;
    modelTrack.style.scrollSnapType = "none";
    modelTrack.scrollLeft = target;
    updateModelCardMotion();
    requestAnimationFrame(() => modelTrack.style.removeProperty("scroll-snap-type"));
  }
}
modelTrack.addEventListener("scroll", () => {
  clearTimeout(modelLoopTimer);
  modelLoopTimer = setTimeout(settleModelLoop, 180);
}, { passive: true });
modelTrack.addEventListener("scrollend", settleModelLoop);
horizontalScroll(modelTrack);
function updateModelCardMotion() {
  const cards = [...modelTrack.querySelectorAll(".person-model-card")], center = modelTrack.scrollLeft + modelTrack.clientWidth / 2;
  for (const card of cards) {
    const distance = Math.min(1, Math.abs(card.offsetLeft + card.offsetWidth / 2 - center) / Math.max(1, modelTrack.clientWidth));
    card.style.setProperty("--model-distance", String(distance));
  }
}
var modelMotionFrame = 0;
modelTrack.addEventListener("scroll", () => {
  cancelAnimationFrame(modelMotionFrame);
  modelMotionFrame = requestAnimationFrame(updateModelCardMotion);
}, { passive: true });
modelTrack.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const step = modelTrack.firstElementChild?.getBoundingClientRect().width || modelTrack.clientWidth;
    modelTrack.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * (step + 14), behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  }
});
el("empty").onclick = openPersonPicker;
el("change-person").onclick = openPersonPicker;
photoClosetView(false);
el("garment-file").onchange = async () => {
  const input = el("garment-file"), file = input.files?.[0];
  if (!file || busy) return;
  busy = true;
  update();
  try {
    const garment = await importGarment(file, file.name, category);
    await saveGarments([garment]);
    items.push(garment);
    selected = selectRealtimeGarment(selected, garment);
    el("photo-consent").checked = false;
    clearResult();
  } catch (error) {
    status(error instanceof Error ? error.message : "\u8863\u7269\u4E0A\u4F20\u5931\u8D25");
    el("photo-status").closest("details").open = true;
  } finally {
    busy = false;
    input.value = "";
    render();
  }
};
horizontalScroll(document.getElementById("photo-selection"));
