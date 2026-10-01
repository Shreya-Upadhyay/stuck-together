import {
  db, configured, onUser, newId, profiles, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp, query, orderBy, arrayUnion, arrayRemove,
} from "./db.js";
import * as A from "./art.js";
import { $, toast, avatar, renderSignIn, renderAccount, handleEmailLink } from "./ui.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const narrow = () => window.matchMedia("(max-width: 700px)").matches;
// Links look like /b#<bookId>, and invite links like /b#<bookId>.<inviteCode>.
const [bookId, inviteCode] = decodeURIComponent(location.hash.slice(1)).split(".");
let me = null, myName = "";

function fail(msg, action = '<a class="pill primary" href="/">go to your scrapbooks</a>') {
  $("status").hidden = false;
  $("status").innerHTML = `<p class="whisper">${A.esc(msg)}</p>${action}`;
  for (const id of ["book-wrap", "nav", "dock", "whisper", "details-btn", "add-page-btn", "share-btn"]) $(id).hidden = true;
  closeSheets();
}
function failWrite(e) {
  console.error(e);
  if (e && e.code === "resource-exhausted") toast("the scrapbook is getting too big to save that. try a smaller photo.");
  else if (e && e.code === "permission-denied") toast("that didn't save. you may have been removed from this scrapbook; reload to check.");
  else toast("that didn't save. check your connection.");
}

function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, val) {
  const ks = path.split(".");
  let o = obj;
  for (const k of ks.slice(0, -1)) { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
  o[ks[ks.length - 1]] = val;
}

// ───────────────────────── state ─────────────────────────
const S = { meta: null, pages: null, stickers: [], photos: {} };
let bookRef, pagesCol, stickersCol, photosCol;

// ───────────────────────── rendering helpers ─────────────────────────
const ed = (path, value, tag = "span", ph = "") =>
  `<${tag} data-path="${path}" data-ph="${A.esc(ph)}" contenteditable="plaintext-only" spellcheck="false">${A.esc(value || "")}</${tag}>`;
const img = (ref, ar, path) =>
  `<div class="img missing" style="--ar:${ar}" data-photo="${path}"><img alt="" draggable="false"><button class="swap" type="button">add photo</button></div>`;
const L = A.layouts({ ed, img, meta: () => S.meta });

const bookEl = $("book");
let pf = null;
let entries = [];
const layers = new Map(); // page id → sticker layer
let structure = "";
let goTo = null;

function pageEntries() {
  const list = S.pages.map((p) => ({ id: p.id, p }));
  if (list.length % 2) list.push({ id: null, p: { type: "pad" }, pad: true });
  return [{ id: "cover", p: { type: "cover" }, hard: true }, ...list, { id: "back", p: { type: "back" }, hard: true }];
}
function pageData(el) {
  const id = el.closest(".page").dataset.pageId;
  return S.pages.find((p) => p.id === id);
}

function makePage(entry, i) {
  const el = document.createElement("div");
  const side = i === 0 ? "right" : i % 2 ? "left" : "right";
  el.className = `page ${side}${entry.hard ? " hard" : ""}`;
  if (entry.hard) el.dataset.density = "hard";
  el.dataset.pageId = entry.id || "";
  if (!entry.hard && !entry.pad) el.dataset.shape = shapeOf(entry.p);
  const fn = L[entry.p.type] || L.blank;
  el.innerHTML = `<div class="inner">${fn(entry.p)}</div>` +
    (entry.hard || entry.pad ? "" : `<button class="page-menu-btn" type="button" aria-label="Page options">&middot;&middot;&middot;</button>`) +
    `<div class="stickers"></div>`;
  if (!entry.pad) layers.set(entry.id, el.querySelector(".stickers"));
  bindPage(el);
  patchPage(el);
  return el;
}

// A page's "shape" is what changes its layout: adding a list item or a sticky note.
const shapeOf = (p) => [p.type, Object.keys(p.items || {}).length, Object.keys(p.notes || {}).length].join(":");
function redrawChangedPages() {
  bookEl.querySelectorAll(".page").forEach((el) => {
    const data = S.pages.find((p) => p.id === el.dataset.pageId);
    if (!data || el.dataset.shape === shapeOf(data)) return;
    el.dataset.shape = shapeOf(data);
    el.querySelector(".inner").innerHTML = (L[data.type] || L.blank)(data);
    bindPage(el);
    patchPage(el);
  });
}

function build() {
  const current = pf ? pf.getCurrentPageIndex() : 0;
  layers.clear();
  entries = pageEntries();
  const els = entries.map(makePage);
  if (!pf) {
    bookEl.append(...els);
    pf = new St.PageFlip(bookEl, {
      width: 420, height: 560, size: "stretch",
      minWidth: 250, maxWidth: 520, minHeight: 333, maxHeight: 693,
      showCover: true, usePortrait: true, autoSize: true,
      maxShadowOpacity: 0.35, flippingTime: 850, drawShadow: true,
      mobileScrollSupport: false, showPageCorners: false, disableFlipByClick: true,
      clickEventForward: true, swipeDistance: 30,
    });
    pf.loadFromHTML(els);
    pf.on("flip", syncChrome);
    pf.on("changeOrientation", () => { syncChrome(); renderSelbar(); });
    pf.on("changeState", (e) => { flipping = e.data !== "read"; syncChrome(); });
  } else {
    pf.updateFromHtml(els);
  }
  let target = Math.min(current, entries.length - 1);
  if (goTo) { const i = entries.findIndex((e) => e.id === goTo); if (i >= 0) target = i; goTo = null; }
  if (target !== pf.getCurrentPageIndex()) pf.turnToPage(target);
  renderStickers();
  syncChrome();
}

// Bring a page's text and photos in line with the latest data, without
// touching whatever someone is typing into right now.
function patchPage(el) {
  const id = el.dataset.pageId;
  const data = id === "cover" || id === "back" ? null : S.pages.find((p) => p.id === id);
  el.querySelectorAll("[data-path]").forEach((t) => {
    if (t === document.activeElement || edits.has(editKey(t))) return;
    const path = t.dataset.path;
    const v = path.startsWith("meta.") ? getPath(S.meta, path.slice(5)) : data && getPath(data, path);
    if ((t.textContent || "") !== (v || "")) t.textContent = v || "";
  });
  el.querySelectorAll("[data-photo]").forEach((box) => setImg(box, data && getPath(data, box.dataset.photo)));
  const rw = el.querySelector(".ransom-wrap");
  if (rw) { const html = A.ransomTitle(S.meta.title || "happy birthday"); if (rw.dataset.html !== html) { rw.innerHTML = html; rw.dataset.html = html; } }
}
function patchAll() { bookEl.querySelectorAll(".page").forEach(patchPage); }

function setImg(box, ref) {
  const im = box.querySelector("img");
  const photo = ref && ref.id ? S.photos[ref.id] : null;
  const src = photo ? photo.data : "";
  if ((im.getAttribute("src") || "") !== src) { if (src) im.src = src; else im.removeAttribute("src"); }
  im.style.objectPosition = (ref && ref.pos) || "50% 35%";
  box.classList.toggle("missing", !src);
  box.querySelector(".swap").textContent = src ? "change photo" : ref && ref.id ? "loading…" : "add photo";
}

// ───────────────────────── editing text ─────────────────────────
const edits = new Map(); // "doc|field" → { timer, run }
function editTarget(t) {
  const path = t.dataset.path;
  if (path.startsWith("meta.")) return { ref: bookRef, field: path.slice(5), obj: S.meta };
  const data = pageData(t);
  return data ? { ref: doc(pagesCol, data.id), field: path, obj: data } : null;
}
function editKey(t) { const x = editTarget(t); return x ? x.ref.path + "|" + x.field : ""; }
function queueWrite(ref, field, value, delay = 500) {
  const key = ref.path + "|" + field;
  const prev = edits.get(key); if (prev) clearTimeout(prev.timer);
  const run = () => { edits.delete(key); updateDoc(ref, { [field]: value }).catch(failWrite); };
  edits.set(key, { timer: setTimeout(run, delay), run });
}
function flushEdits() { for (const e of [...edits.values()]) { clearTimeout(e.timer); e.run(); } }
window.addEventListener("pagehide", flushEdits);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushEdits(); });

const stopFlip = (node) => {
  node.addEventListener("mousedown", (e) => e.stopPropagation());
  node.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
};

function bindPage(el) {
  el.querySelectorAll("[data-path]").forEach((t) => {
    if (t.contentEditable !== "plaintext-only") t.contentEditable = "true";
    stopFlip(t);
    const multi = /(^|\.)(text|note)$/.test(t.dataset.path);
    t.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if ((e.key === "Enter" && !multi) || e.key === "Escape") { e.preventDefault(); t.blur(); }
    });
    t.addEventListener("paste", (e) => {
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    });
    t.addEventListener("input", () => {
      const x = editTarget(t); if (!x) return;
      const v = t.innerText.replace(/\n$/, "").slice(0, 4000);
      setPath(x.obj, x.field, v);
      bookEl.querySelectorAll(`[data-path="${t.dataset.path}"]`).forEach((o) => {
        if (o !== t && editKey(o) === editKey(t)) o.textContent = v;
      });
      queueWrite(x.ref, x.field, v);
    });
    t.addEventListener("blur", flushEdits);
  });
  el.querySelectorAll("[data-photo] .swap").forEach((btn) => {
    stopFlip(btn);
    btn.addEventListener("click", (e) => { e.stopPropagation(); pickPhoto(btn.parentElement); });
  });
  const rw = el.querySelector(".ransom-wrap");
  if (rw) { stopFlip(rw); rw.addEventListener("click", openDetails); }
  const add = el.querySelector(".add-item");
  if (add) {
    stopFlip(add);
    add.addEventListener("click", () => {
      const data = pageData(add); if (!data) return;
      const k = add.dataset.next;
      setPath(data, "items." + k, "");
      redrawChangedPages();
      updateDoc(doc(pagesCol, data.id), { ["items." + k]: "" }).catch(failWrite);
    });
  }
  const note = el.querySelector(".add-note");
  if (note) {
    stopFlip(note);
    note.addEventListener("click", () => {
      const data = pageData(note); if (!data) return;
      const k = note.dataset.next, fresh = { text: "", by: myName };
      setPath(data, "notes." + k, fresh);
      redrawChangedPages();
      updateDoc(doc(pagesCol, data.id), { ["notes." + k]: fresh }).catch(failWrite);
    });
  }
  const menu = el.querySelector(".page-menu-btn");
  if (menu) { stopFlip(menu); menu.addEventListener("click", (e) => { e.stopPropagation(); openPageMenu(menu); }); }
}

// ───────────────────────── photos ─────────────────────────
let photoTarget = null;
function pickPhoto(box) { photoTarget = box; $("photo-input").value = ""; $("photo-input").click(); }

// Shrinks a photo on the device so it fits in one database document (under 1 MB).
async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  let max = 1400, q = 0.85, data = "";
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    data = c.toDataURL("image/jpeg", q);
    if (data.length < 900_000) return { data, w: c.width, h: c.height };
    if (q > 0.6) q -= 0.1; else { max = Math.round(max * 0.8); q = 0.8; }
  }
  throw new Error("too-big");
}

$("photo-input").addEventListener("change", async () => {
  const file = $("photo-input").files[0], box = photoTarget;
  if (!file || !box) return;
  const data = pageData(box); if (!data) return;
  const path = box.dataset.photo;
  box.querySelector(".swap").textContent = "adding…";
  let shrunk;
  try { shrunk = await shrinkPhoto(file); }
  catch (_) {
    setImg(box, getPath(data, path));
    toast("couldn't read that photo. JPG or PNG works best (iPhone photos work from Safari).");
    return;
  }
  const id = newId(16);
  try {
    await setDoc(doc(photosCol, id), { ...shrunk, at: serverTimestamp() });
    S.photos[id] = shrunk;
    setPath(data, path + ".id", id);
    setImg(box, getPath(data, path));
    await updateDoc(doc(pagesCol, data.id), { [path + ".id"]: id });
    if (!$("sheet").hidden) renderSheet();
  } catch (e) { setImg(box, getPath(data, path)); failWrite(e); }
});

// ───────────────────────── pages ─────────────────────────
let flipping = false;
const spiral = $("spiral");
spiral.innerHTML = "<i></i>".repeat(17);
function syncChrome() {
  if (!pf) return;
  const i = pf.getCurrentPageIndex(), n = entries.length;
  const land = pf.getOrientation() === "landscape";
  spiral.hidden = !land || flipping || i === 0 || i >= n - 1;
  $("count").textContent = land && i > 0 && i < n - 1 ? `${i + 1}–${Math.min(i + 2, n)} / ${n}` : `${i + 1} / ${n}`;
  $("prev").disabled = i === 0;
  $("next").disabled = i >= n - 1;
}
$("prev").onclick = () => pf && pf.flipPrev();
$("next").onclick = () => pf && pf.flipNext();

function visibleEntries() {
  if (!pf) return [];
  const i = pf.getCurrentPageIndex();
  const idx = pf.getOrientation() !== "landscape" || i === 0 || i >= entries.length - 1 ? [i] : [i, i + 1];
  return idx.map((k) => entries[k]).filter((e) => e && !e.pad);
}

function renderTypes() {
  $("type-grid").innerHTML = A.PAGE_TYPES.map((t) => `<button class="type-card" data-type="${t.type}"><b>${t.name}</b><span>${t.desc}</span></button>`).join("");
  $("type-grid").querySelectorAll("[data-type]").forEach((b) => (b.onclick = () => addPage(b.dataset.type)));
}
async function addPage(type) {
  closeSheets();
  const vis = visibleEntries().filter((e) => e.id !== "cover" && e.id !== "back");
  const after = vis.length ? vis[vis.length - 1].id : null;
  const onCover = pf && pf.getCurrentPageIndex() === 0;
  const pages = S.pages;
  let order;
  if (!pages.length) order = 0;
  else if (onCover || !after) order = onCover ? pages[0].order - 1 : pages[pages.length - 1].order + 1;
  else {
    const j = pages.findIndex((p) => p.id === after);
    order = j + 1 < pages.length ? (pages[j].order + pages[j + 1].order) / 2 : pages[j].order + 1;
  }
  const id = newId(16);
  goTo = id;
  try { await setDoc(doc(pagesCol, id), { ...A.freshPage(type), order }); toast("page added"); }
  catch (e) { goTo = null; failWrite(e); }
}

let menuPage = null, menuArmed = false;
function openPageMenu(btn) {
  const m = $("page-menu"), r = btn.getBoundingClientRect();
  menuPage = btn.closest(".page").dataset.pageId; menuArmed = false;
  $("remove-page").textContent = "remove this page";
  m.hidden = false;
  m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + "px";
  m.style.top = r.bottom + window.scrollY + 6 + "px";
}
$("remove-page").onclick = async () => {
  if (!menuArmed) { menuArmed = true; $("remove-page").textContent = "sure? remove it and its stickers"; return; }
  const id = menuPage; $("page-menu").hidden = true;
  if (!id) return;
  const batch = writeBatch(db);
  batch.delete(doc(pagesCol, id));
  for (const s of S.stickers) if (s.page === id) batch.delete(doc(stickersCol, s.id));
  try { await batch.commit(); toast("page removed"); } catch (e) { failWrite(e); }
};

// ───────────────────────── stickers ─────────────────────────
const stickerEls = new Map();
const stickerWrites = new Map(); // id → timer
let sel = null, drag = null;
const maxZ = () => S.stickers.reduce((m, s) => Math.max(m, s.z || 0), 0);
const widthOf = (st) => (st.kind === "photo" ? 30 : st.kind === "tape" ? 34 : 17) * st.s;
const strip = (o) => { const { id, ...rest } = o; return rest; };

function stickerHtml(st) {
  if (st.kind === "photo") return A.photoSticker(S.photos[st.photo] ? S.photos[st.photo].data : "", st.shape, st.id);
  if (st.kind === "doodle") return A.doodleSvg(st.doodle);
  if (st.kind === "tape") return A.washi(st.pattern, st.color);
  return A.wordInner(st);
}
function renderStickers() {
  const seen = new Set();
  for (const st of S.stickers) {
    const layer = layers.get(st.page); if (!layer) continue;
    seen.add(st.id);
    const src = st.kind === "photo" && S.photos[st.photo] ? "y" : "n";
    const sig = [st.kind, st.photo, src, st.shape, st.doodle, st.text, st.style, st.color, st.pattern].join("|");
    let el = stickerEls.get(st.id);
    if (!el || el.dataset.sig !== sig) {
      if (el) el.remove();
      el = document.createElement("div");
      el.className = "stk" + (st.kind === "word" ? " word" : "");
      el.dataset.id = st.id; el.dataset.sig = sig;
      el.innerHTML = stickerHtml(st);
      stopFlip(el);
      el.addEventListener("pointerdown", startDrag);
      stickerEls.set(st.id, el);
    }
    if (el.parentElement !== layer) layer.appendChild(el);
    if (drag && drag.id === st.id) continue;
    el.style.left = st.x + "%"; el.style.top = st.y + "%";
    el.style.setProperty("--r", st.r + "deg"); el.style.setProperty("--s", st.s);
    el.style.zIndex = st.z || 1;
    if (st.kind !== "word") el.style.width = widthOf(st) + "%";
    el.classList.toggle("sel", sel === st.id);
  }
  for (const [id, el] of stickerEls) if (!seen.has(id)) { el.remove(); stickerEls.delete(id); }
  if (sel && !seen.has(sel)) sel = null;
  renderSelbar();
}
function saveSticker(st, now) {
  clearTimeout(stickerWrites.get(st.id));
  stickerWrites.set(st.id, setTimeout(async () => {
    try { await setDoc(doc(stickersCol, st.id), strip(st)); }
    catch (e) { failWrite(e); }
    finally { stickerWrites.delete(st.id); }
  }, now ? 0 : 400));
}
function addSticker(base) {
  const vis = visibleEntries(); if (!vis.length) return;
  const count = (id) => S.stickers.filter((s) => s.page === id).length;
  const page = vis.length > 1 && count(vis[0].id) < count(vis[1].id) ? vis[0].id : vis[vis.length - 1].id;
  const st = { ...base, id: newId(16), page, x: +(50 + Math.random() * 30 - 15).toFixed(1), y: +(45 + Math.random() * 30 - 15).toFixed(1), s: 1, r: Math.round(Math.random() * 20 - 10), z: maxZ() + 1 };
  S.stickers.push(st); sel = st.id; renderStickers(); saveSticker(st, true);
  if (narrow()) closeSheets();
}
function select(id) { if (sel !== id) { sel = id; renderStickers(); } }

function startDrag(e) {
  const el = e.currentTarget, st = S.stickers.find((s) => s.id === el.dataset.id);
  if (!st) return;
  e.preventDefault(); e.stopPropagation();
  select(st.id);
  drag = { id: st.id, el, sx: e.clientX, sy: e.clientY, x0: st.x, y0: st.y, x: st.x, y: st.y, rect: el.parentElement.getBoundingClientRect(), moved: false };
  el.style.zIndex = maxZ() + 1;
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
  el.addEventListener("pointermove", moveDrag);
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}
function moveDrag(e) {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) drag.moved = true;
  drag.x = clamp(drag.x0 + ((e.clientX - drag.sx) / drag.rect.width) * 100, 0, 100);
  drag.y = clamp(drag.y0 + ((e.clientY - drag.sy) / drag.rect.height) * 100, 0, 100);
  drag.el.style.left = drag.x + "%"; drag.el.style.top = drag.y + "%";
}
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  d.el.removeEventListener("pointermove", moveDrag);
  d.el.removeEventListener("pointerup", endDrag);
  d.el.removeEventListener("pointercancel", endDrag);
  const st = S.stickers.find((s) => s.id === d.id);
  if (st && d.moved) { st.x = +d.x.toFixed(2); st.y = +d.y.toFixed(2); st.z = maxZ() + 1; saveSticker(st, true); }
  renderStickers();
}
document.addEventListener("pointerdown", (e) => {
  if (sel && !e.target.closest(".stk, .selbar, .sheet, .dock")) select(null);
  if (!$("page-menu").hidden && !e.target.closest("#page-menu, .page-menu-btn")) $("page-menu").hidden = true;
});

function partnerPage(id) {
  const i = entries.findIndex((e) => e.id === id);
  if (i <= 0 || i >= entries.length - 1) return null;
  const j = i % 2 ? i + 1 : i - 1;
  const other = entries[j];
  return other && !other.pad && j < entries.length ? other : null;
}
function renderSelbar() {
  const bar = $("selbar");
  const st = S.stickers.find((s) => s.id === sel);
  if (!st) { bar.hidden = true; $("pouch").hidden = false; return; }
  const other = pf && pf.getOrientation() === "landscape" ? partnerPage(st.page) : null;
  const i = entries.findIndex((e) => e.id === st.page);
  bar.innerHTML = `
    <button data-a="tl" aria-label="Tilt left">↺ tilt</button>
    <button data-a="tr" aria-label="Tilt right">tilt ↻</button>
    <button data-a="sm">smaller</button>
    <button data-a="lg">bigger</button>
    <button data-a="up">to front</button>
    ${other ? `<button data-a="mv">move to ${entries.indexOf(other) < i ? "left" : "right"} page</button>` : ""}
    <button data-a="peel" class="peel">peel off</button>
    <button data-a="done">done</button>`;
  bar.querySelectorAll("button").forEach((b) => (b.onclick = () => act(b.dataset.a)));
  bar.hidden = false; $("pouch").hidden = narrow();
}
function act(a) {
  const st = S.stickers.find((s) => s.id === sel); if (!st) return;
  if (a === "done") { select(null); return; }
  if (a === "peel") {
    clearTimeout(stickerWrites.get(st.id)); stickerWrites.delete(st.id);
    S.stickers = S.stickers.filter((s) => s !== st); sel = null; renderStickers();
    deleteDoc(doc(stickersCol, st.id)).catch(failWrite);
    return;
  }
  if (a === "tl") st.r -= 10;
  if (a === "tr") st.r += 10;
  if (a === "sm") st.s = clamp(+(st.s / 1.15).toFixed(3), 0.35, 3.5);
  if (a === "lg") st.s = clamp(+(st.s * 1.15).toFixed(3), 0.35, 3.5);
  if (a === "up") st.z = maxZ() + 1;
  if (a === "mv") { const o = partnerPage(st.page); if (o) st.page = o.id; }
  renderStickers(); saveSticker(st);
}

// ───────────────────────── sheets ─────────────────────────
const ui = { tab: "faces", shape: "heart", wordStyle: "label", word: "", color: A.TAPE_COLORS[0] };
function closeSheets() {
  for (const id of ["sheet", "add-sheet", "details-sheet", "share-sheet"]) $(id).hidden = true;
  $("pouch").setAttribute("aria-expanded", "false");
}
function openSheet(id) { closeSheets(); $(id).hidden = false; }
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeSheets));

function renderSheet() {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === ui.tab)));
  const body = $("sheet-body");
  if (ui.tab === "faces") {
    const ids = Object.keys(S.photos);
    body.innerHTML = `<div class="chips" role="group" aria-label="Shape">${Object.entries(A.SHAPES).map(([k, v]) => `<button class="chip" data-shape="${k}" aria-pressed="${ui.shape === k}">${v.label}</button>`).join("")}</div>
      <div class="tray">${ids.length ? ids.map((id) => `<button data-photo-id="${id}" aria-label="Add photo sticker">${A.photoSticker(S.photos[id].data, ui.shape, "tray" + id)}</button>`).join("")
        : `<p class="empty">Photos added to the book show up here as stickers.</p>`}</div>`;
    body.querySelectorAll("[data-shape]").forEach((b) => (b.onclick = () => { ui.shape = b.dataset.shape; renderSheet(); }));
    body.querySelectorAll("[data-photo-id]").forEach((b) => (b.onclick = () => addSticker({ kind: "photo", photo: b.dataset.photoId, shape: ui.shape })));
  } else if (ui.tab === "doodles") {
    body.innerHTML = `<div class="tray">${Object.entries(A.DOODLES).map(([k, v]) => `<button data-k="${k}" aria-label="Add ${v.label} sticker">${A.doodleSvg(k)}</button>`).join("")}</div>`;
    body.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => addSticker({ kind: "doodle", doodle: b.dataset.k })));
  } else if (ui.tab === "tape") {
    const tapes = A.TAPES.flatMap((t) => (t.key === "floral" ? [[t, "#F3EADD"]] : A.TAPE_COLORS.map((c) => [t, c])));
    body.innerHTML = `<div class="tray">${tapes.map(([t, c]) => `<button data-pattern="${t.key}" data-color="${c}" aria-label="Add ${t.label} tape">${A.washi(t.key, c)}</button>`).join("")}</div>`;
    body.querySelectorAll("[data-pattern]").forEach((b) => (b.onclick = () => addSticker({ kind: "tape", pattern: b.dataset.pattern, color: b.dataset.color })));
  } else {
    const preview = { id: "preview", text: ui.word || "bestie 4ever", style: ui.wordStyle, color: ui.color };
    body.innerHTML = `
      <form class="word-maker" id="word-form">
        <input id="word-input" maxlength="24" placeholder="bestie 4ever" value="${A.esc(ui.word)}" aria-label="Sticker words">
        <button class="pill primary" type="submit">stick it</button>
      </form>
      <div class="chips" role="group" aria-label="Style">
        ${[["label", "typewriter label"], ["tape", "washi tape"], ["ransom", "cut-out letters"]].map(([k, l]) => `<button class="chip" data-style="${k}" aria-pressed="${ui.wordStyle === k}">${l}</button>`).join("")}
      </div>
      <div class="word-preview"><div class="stk word">${A.wordInner(preview)}</div></div>
      <div class="presets">${A.PRESET_WORDS.map((w) => `<button class="chip" type="button" data-word="${A.esc(w)}">${A.esc(w)}</button>`).join("")}</div>`;
    body.querySelectorAll("[data-word]").forEach((b) => (b.onclick = () => addSticker({ kind: "word", text: b.dataset.word, style: ui.wordStyle, color: ui.color })));
    const inp = $("word-input");
    inp.oninput = () => { ui.word = inp.value; body.querySelector(".word-preview .stk").innerHTML = A.wordInner({ ...preview, text: ui.word || "bestie 4ever" }); };
    body.querySelectorAll("[data-style]").forEach((b) => (b.onclick = () => { ui.wordStyle = b.dataset.style; ui.color = A.TAPE_COLORS[Math.floor(Math.random() * A.TAPE_COLORS.length)]; renderSheet(); }));
    $("word-form").onsubmit = (e) => {
      e.preventDefault();
      const text = ui.word.trim(); if (!text) { inp.focus(); return; }
      addSticker({ kind: "word", text, style: ui.wordStyle, color: ui.color });
      ui.word = ""; if (!$("sheet").hidden) renderSheet();
    };
  }
}
$("pouch").onclick = () => {
  if (!$("sheet").hidden) { closeSheets(); return; }
  openSheet("sheet"); $("pouch").setAttribute("aria-expanded", "true"); renderSheet();
};
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { ui.tab = b.dataset.tab; renderSheet(); }));

$("add-page-btn").onclick = () => { renderTypes(); openSheet("add-sheet"); };

// ───────────────────────── the cover ─────────────────────────
let pickedTheme = "kraft", dangerArmed = false;
const isOwner = () => S.meta && me && S.meta.owner === me.uid;
function applyTheme() { bookEl.className = "book-theme theme-" + ((S.meta && S.meta.theme) || "kraft"); }
function renderThemes() {
  $("d-themes").innerHTML = A.THEMES.map((t) => `<button type="button" class="swatch" data-theme="${t.key}" aria-pressed="${pickedTheme === t.key}"><i style="--sw:${t.swatch}"></i>${t.label}</button>`).join("");
  $("d-themes").querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => { pickedTheme = b.dataset.theme; renderThemes(); }));
}
function renderDanger() {
  dangerArmed = false;
  $("danger-zone").innerHTML = isOwner()
    ? `<h3>you made this scrapbook</h3><div class="row-actions"><button class="pill danger" id="delete-book">delete this scrapbook</button></div><p class="form-note">deleting removes it for everyone, with all its pages, photos and stickers.</p>`
    : `<h3>leave</h3><div class="row-actions"><button class="pill danger" id="leave-book">leave this scrapbook</button></div><p class="form-note">it disappears from your shelf. a friend can invite you back.</p>`;
  const del = $("delete-book"), leave = $("leave-book");
  if (del) del.onclick = async () => {
    if (!dangerArmed) { dangerArmed = true; del.textContent = "sure? delete it for everyone"; return; }
    del.disabled = true; del.textContent = "deleting…";
    try { await deleteBook(); location.href = "/"; } catch (e) { failWrite(e); del.disabled = false; renderDanger(); }
  };
  if (leave) leave.onclick = async () => {
    if (!dangerArmed) { dangerArmed = true; leave.textContent = "sure? leave it"; return; }
    try { await updateDoc(bookRef, { members: arrayRemove(me.uid) }); location.href = "/"; } catch (e) { failWrite(e); }
  };
}
async function deleteBook() {
  // Firestore doesn't delete a document's subcollections, so clear them first (batches of up to 450).
  const refs = [];
  for (const col of [pagesCol, stickersCol, photosCol]) (await getDocs(col)).forEach((d) => refs.push(d.ref));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(bookRef);
}
function openDetails() {
  const m = S.meta || {};
  $("d-title").value = m.title || ""; $("d-name").value = m.name || "";
  $("d-date").value = m.date || ""; $("d-from").value = m.from || "";
  pickedTheme = m.theme || "kraft";
  renderThemes(); renderDanger();
  openSheet("details-sheet");
}
$("details-btn").onclick = openDetails;
$("details-form").onsubmit = async (e) => {
  e.preventDefault();
  const next = { title: $("d-title").value.trim(), name: $("d-name").value.trim(), date: $("d-date").value.trim(), from: $("d-from").value.trim(), theme: pickedTheme };
  Object.assign(S.meta, next); applyTheme(); patchAll(); closeSheets();
  try { await updateDoc(bookRef, next); toast("cover updated"); } catch (err) { failWrite(err); }
};

// ───────────────────────── friends ─────────────────────────
const inviteLink = () => `${location.origin}/b#${bookId}.${S.meta.inviteCode}`;
async function renderMembers() {
  const ids = S.meta.members || [];
  const people = await profiles(ids);
  $("members").innerHTML = ids.map((u) => `<li>${avatar(people[u], u, 30)}<span class="name">${A.esc((people[u] || {}).name || "a friend")}${u === me.uid ? " (you)" : ""}</span>
    ${u === S.meta.owner ? '<span class="tag">made it</span>' : isOwner() ? `<button data-remove="${A.esc(u)}">remove</button>` : ""}</li>`).join("");
  $("members").querySelectorAll("[data-remove]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "sure?"; return; }
    try { await updateDoc(bookRef, { members: arrayRemove(b.dataset.remove) }); toast("removed"); } catch (e) { failWrite(e); }
  }));
  $("share-link").value = inviteLink();
}
$("share-btn").onclick = () => { openSheet("share-sheet"); renderMembers(); };
$("copy-link").onclick = async () => {
  const inp = $("share-link");
  try { await navigator.clipboard.writeText(inp.value); toast("invite link copied ♡"); }
  catch (_) { inp.focus(); inp.select(); toast("press ctrl+c (or long-press) to copy"); }
};
$("reset-link").onclick = async () => {
  try { await updateDoc(bookRef, { inviteCode: newId(22) }); toast("new invite link made. the old one no longer works."); }
  catch (e) { failWrite(e); }
};

document.addEventListener("keydown", (e) => {
  const a = document.activeElement;
  if (a && (/INPUT|TEXTAREA/.test(a.tagName) || a.isContentEditable)) return;
  if (sel && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); act("peel"); return; }
  if (e.key === "ArrowRight" && pf) pf.flipNext();
  if (e.key === "ArrowLeft" && pf) pf.flipPrev();
  if (e.key === "Escape") { closeSheets(); select(null); $("page-menu").hidden = true; }
});
window.addEventListener("resize", renderSelbar);

// ───────────────────────── live data ─────────────────────────
function maybeStart() {
  if (!S.meta || !S.pages) return;
  const sig = S.pages.map((p) => p.id + ":" + p.type).join("|");
  if (!pf) {
    $("status").hidden = true;
    for (const id of ["book-wrap", "nav", "dock", "whisper", "details-btn", "add-page-btn", "share-btn"]) $(id).hidden = false;
    structure = sig; build();
  } else if (sig !== structure) {
    structure = sig; build();
  } else {
    redrawChangedPages();
    patchAll();
  }
}

// ───────────────────────── opening the book ─────────────────────────
const denied = (e) => e && e.code === "permission-denied";

// Opens the book for a signed-in person, joining first if they came from an invite link.
async function open() {
  bookRef = doc(db, "books", bookId);
  pagesCol = collection(bookRef, "pages");
  stickersCol = collection(bookRef, "stickers");
  photosCol = collection(bookRef, "photos");

  let readable = false;
  try { readable = (await getDoc(bookRef)).exists(); }
  catch (e) { if (!denied(e)) { console.error(e); fail("couldn't open this scrapbook. check your connection and reload."); return; } }

  if (!readable && inviteCode) {
    try {
      await updateDoc(bookRef, { members: arrayUnion(me.uid), joinWith: inviteCode });
      readable = true;
      toast("you're in! ♡");
    } catch (e) {
      console.error(e);
      fail("this invite link doesn't work anymore. ask a friend in the scrapbook for a new one.");
      return;
    }
  }
  if (inviteCode) history.replaceState(null, "", "/b#" + bookId);
  if (!readable) { fail("you're not in this scrapbook yet. ask a friend in it to send you the invite link."); return; }
  subscribe();
}

function subscribe() {
  const lost = (e) => {
    if (denied(e)) fail("you're not in this scrapbook anymore.");
    else toast("lost the live connection. reload to catch up.");
  };
  onSnapshot(bookRef, (s) => {
    if (!s.exists()) { fail("this scrapbook was deleted."); return; }
    const prev = S.meta;
    S.meta = { ...s.data() };
    // keep what this person is still typing on the cover
    if (prev) for (const k of edits.keys()) { const [p, f] = k.split("|"); if (p === bookRef.path) setPath(S.meta, f, getPath(prev, f)); }
    document.title = `${S.meta.title || "a scrapbook"}${S.meta.name ? " for " + S.meta.name : ""} ♡`;
    applyTheme();
    if (!$("share-sheet").hidden) renderMembers();
    maybeStart();
  }, lost);
  onSnapshot(query(pagesCol, orderBy("order")), (q) => {
    const local = new Map((S.pages || []).map((p) => [p.id, p]));
    S.pages = q.docs.map((d) => {
      const fresh = { ...d.data(), id: d.id };
      // keep what this person is still typing
      for (const k of edits.keys()) {
        const [p, f] = k.split("|");
        if (p === `${pagesCol.path}/${d.id}` && local.has(d.id)) setPath(fresh, f, getPath(local.get(d.id), f));
      }
      return fresh;
    });
    maybeStart();
  }, lost);
  onSnapshot(stickersCol, (q) => {
    const local = new Map(S.stickers.map((s) => [s.id, s]));
    S.stickers = q.docs.map((d) => (stickerWrites.has(d.id) && local.get(d.id)) || { ...d.data(), id: d.id });
    for (const [id, s] of local) if (stickerWrites.has(id) && !S.stickers.some((x) => x.id === id)) S.stickers.push(s);
    if (pf) renderStickers();
  }, lost);
  onSnapshot(photosCol, (q) => {
    const next = {};
    for (const d of q.docs) next[d.id] = d.data();
    S.photos = next;
    if (pf) { patchAll(); renderStickers(); }
    if (!$("sheet").hidden && ui.tab === "faces") renderSheet();
  }, lost);
}

(async () => {
  if (!/^[A-Za-z0-9]{16,40}$/.test(bookId || "")) { fail("this link doesn't lead to a scrapbook. check that you copied all of it."); return; }
  if (!configured) { fail("this site isn't connected to Firebase yet. add your config to public/js/firebase-config.js (see the README).", ""); return; }
  await handleEmailLink();
  let started = false;
  onUser(async (user) => {
    me = user;
    renderAccount($("account"), user);
    if (!user) {
      if (started) { location.reload(); return; }
      $("status").hidden = false;
      $("status").innerHTML = `<div class="signin-card"><div id="signin"></div></div>`;
      renderSignIn($("signin"), inviteCode ? "you've been invited to a scrapbook ♡ sign in to join." : "sign in to open this scrapbook.");
      return;
    }
    if (started) return;
    started = true;
    $("status").innerHTML = `<p class="whisper">${inviteCode ? "joining the scrapbook…" : "opening the scrapbook…"}</p>`;
    myName = ((await profiles([user.uid]))[user.uid] || {}).name || "";
    open();
  });
})();
