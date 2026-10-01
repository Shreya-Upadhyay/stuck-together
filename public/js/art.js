// Drawings, sticker art and page layouts. Pure functions: they return HTML strings.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

// ───────── shapes + stickers ─────────
const HEART = "M50 88 C22 68 8 52 9 33 C10 18 22 9 35 10 C43 11 48 16 50 22 C52 16 57 11 65 10 C78 9 90 18 91 33 C92 52 78 68 50 88Z";
function starPath(n, R, r, cy = 52) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, rad = i % 2 ? r : R;
    d += (i ? "L" : "M") + (50 + rad * Math.cos(a)).toFixed(1) + " " + (cy + rad * Math.sin(a)).toFixed(1);
  }
  return d + "Z";
}
function scallopPath() {
  let d = "";
  for (let i = 0; i <= 144; i++) {
    const a = (i / 144) * Math.PI * 2, rad = 41 * (0.9 + 0.1 * Math.cos(12 * a));
    d += (i ? "L" : "M") + (50 + rad * Math.cos(a)).toFixed(1) + " " + (50 + rad * Math.sin(a)).toFixed(1);
  }
  return d + "Z";
}
export const SHAPES = {
  heart: { label: "heart", d: HEART },
  circle: { label: "circle", d: "M50 8 A42 42 0 1 1 49.99 8Z" },
  scallop: { label: "scallop", d: scallopPath() },
  star: { label: "star", d: starPath(5, 46, 25) },
  square: { label: "square", d: "M22 10 H78 Q90 10 90 22 V78 Q90 90 78 90 H22 Q10 90 10 78 V22 Q10 10 22 10Z" },
};
export function photoSticker(src, shape, uid) {
  const d = (SHAPES[shape] || SHAPES.heart).d;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="cp-${uid}"><path d="${d}"/></clipPath></defs>
    <path d="${d}" fill="#FAF5EC" stroke="#FAF5EC" stroke-width="13" stroke-linejoin="round"/>
    ${src ? `<image href="${esc(src)}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp-${uid})"/>` : `<path d="${d}" fill="#EED6CF"/>`}</svg>`;
}
export function bowSvg(p = "bw") {
  const K = 'stroke="#2B2522" stroke-width="2" stroke-linejoin="round"';
  return `<svg viewBox="0 0 100 90" aria-hidden="true">
    <path d="M46 44 L32 82 L40 78 L45 86 L52 48Z" fill="url(#${p})" ${K}/>
    <path d="M54 44 L68 82 L60 78 L55 86 L48 48Z" fill="url(#${p})" ${K}/>
    <path d="M50 40 C38 22 12 16 9 32 C6 48 32 52 50 46Z" fill="url(#${p})" ${K}/>
    <path d="M50 40 C62 22 88 16 91 32 C94 48 68 52 50 46Z" fill="url(#${p})" ${K}/>
    <rect x="43" y="34" width="14" height="16" rx="5" fill="url(#${p})" ${K}/></svg>`;
}
const K = 'stroke="#4A3426" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
export const DOODLES = {
  heart: { label: "heart", svg: `<path d="${HEART}" fill="#D6A39D" ${K}/><path d="M24 30 C26 22 31 19 37 20" fill="none" stroke="#FAF5EC" stroke-width="4" stroke-linecap="round"/>` },
  bow: { label: "bow", raw: () => bowSvg("bw") },
  rosebow: { label: "pink bow", raw: () => bowSvg("rw") },
  daisy: { label: "daisy", svg: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="50" cy="27" rx="9" ry="17" transform="rotate(${a} 50 50)" fill="#FAF5EC" ${K}/>`).join("") + `<circle cx="50" cy="50" r="11" fill="#EAD9A8" ${K}/>` },
  star: { label: "star", svg: `<path d="${starPath(5, 42, 19)}" fill="#EAD9A8" ${K}/>` },
  sparkle: { label: "sparkle", svg: `<path d="M50 8 C54 40 60 46 92 50 C60 54 54 60 50 92 C46 60 40 54 8 50 C40 46 46 40 50 8Z" fill="#BFB3CF" ${K}/>` },
  cherries: { label: "cherries", svg: `<path d="M36 70 C40 50 48 32 60 16 M66 66 C64 48 62 32 60 16" fill="none" ${K}/><path d="M60 16 C70 8 84 10 88 18 C78 24 66 22 60 16Z" fill="#AAB597" ${K}/><circle cx="34" cy="72" r="14" fill="#C98A84" ${K}/><circle cx="66" cy="68" r="14" fill="#C98A84" ${K}/><path d="M27 67 C28 63 31 61 34 61" fill="none" stroke="#FAF5EC" stroke-width="3" stroke-linecap="round"/>` },
  letter: { label: "love letter", svg: `<rect x="10" y="24" width="80" height="54" rx="4" fill="#FAF5EC" ${K}/><path d="M10 28 L50 58 L90 28" fill="none" ${K}/><path d="M50 66 C42 60 40 56 41 53 C42 50 46 49 50 53 C54 49 58 50 59 53 C60 56 58 60 50 66Z" fill="#C98A84" ${K}/>` },
  cake: { label: "cake", svg: `<rect x="47" y="22" width="6" height="22" fill="#AAB597" ${K}/><path d="M50 7 C55 13 55 18 50 20 C45 18 45 13 50 7Z" fill="#E7B77A" ${K}/><rect x="16" y="44" width="68" height="40" rx="6" fill="#EED6CF" ${K}/><path d="M16 54 C22 62 28 62 32 54 C36 62 44 62 48 54 C52 62 60 62 64 54 C68 62 76 62 84 54 V50 C84 46 82 44 78 44 H22 C18 44 16 46 16 50Z" fill="#FAF5EC" ${K}/>` },
  butterfly: { label: "butterfly", svg: `<ellipse cx="33" cy="38" rx="18" ry="21" transform="rotate(-22 33 38)" fill="#BFB3CF" ${K}/><ellipse cx="67" cy="38" rx="18" ry="21" transform="rotate(22 67 38)" fill="#BFB3CF" ${K}/><ellipse cx="37" cy="66" rx="12" ry="14" transform="rotate(20 37 66)" fill="#EED6CF" ${K}/><ellipse cx="63" cy="66" rx="12" ry="14" transform="rotate(-20 63 66)" fill="#EED6CF" ${K}/><ellipse cx="50" cy="52" rx="4" ry="23" fill="#4A3426"/><path d="M48 30 C44 20 40 16 36 14 M52 30 C56 20 60 16 64 14" fill="none" ${K}/>` },
  stamp: { label: "stamp", svg: `<rect x="14" y="12" width="72" height="76" fill="#FAF5EC"/><rect x="14" y="12" width="72" height="76" fill="none" stroke="#EFE7DC" stroke-width="7" stroke-dasharray="0 8" stroke-linecap="round"/><rect x="24" y="22" width="52" height="56" fill="#EED6CF" ${K}/><path d="M50 66 C36 56 32 49 33 43 C34 37 42 35 50 43 C58 35 66 37 67 43 C68 49 64 56 50 66Z" fill="#C98A84" ${K}/>` },
  sun: { label: "sun", svg: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 10 L50 22" transform="rotate(${a} 50 50)" ${K} fill="none"/>`).join("") + `<circle cx="50" cy="50" r="20" fill="#EAD9A8" ${K}/>` },
  moon: { label: "moon", svg: `<path d="M60 12 A38 38 0 1 0 88 66 A30 30 0 1 1 60 12Z" fill="#EAD9A8" ${K}/><circle cx="30" cy="30" r="2.5" fill="#4A3426"/><circle cx="78" cy="26" r="2" fill="#4A3426"/>` },
  cloud: { label: "cloud", svg: `<path d="M26 72 C12 72 10 52 24 48 C22 32 42 24 52 34 C58 22 80 26 78 44 C92 46 92 72 76 72Z" fill="#FAF5EC" ${K}/>` },
  rainbow: { label: "rainbow", svg: `<path d="M16 72 A34 34 0 0 1 84 72" fill="none" stroke="#D6A39D" stroke-width="9" stroke-linecap="round"/><path d="M27 72 A23 23 0 0 1 73 72" fill="none" stroke="#EAD9A8" stroke-width="9" stroke-linecap="round"/><path d="M38 72 A12 12 0 0 1 62 72" fill="none" stroke="#AAB597" stroke-width="9" stroke-linecap="round"/><circle cx="16" cy="76" r="9" fill="#FAF5EC" ${K}/><circle cx="84" cy="76" r="9" fill="#FAF5EC" ${K}/>` },
  gift: { label: "gift", svg: `<rect x="20" y="44" width="60" height="40" rx="3" fill="#D6A39D" ${K}/><rect x="15" y="33" width="70" height="13" rx="3" fill="#EED6CF" ${K}/><rect x="45" y="33" width="10" height="51" fill="#FAF5EC" ${K}/><path d="M50 33 C40 18 26 22 32 30 C36 34 44 33 50 33 C56 33 64 34 68 30 C74 22 60 18 50 33Z" fill="#FAF5EC" ${K}/>` },
  camera: { label: "camera", svg: `<rect x="30" y="22" width="20" height="10" rx="3" fill="#BFB3CF" ${K}/><rect x="12" y="30" width="76" height="50" rx="9" fill="#BFB3CF" ${K}/><circle cx="50" cy="55" r="17" fill="#FAF5EC" ${K}/><circle cx="50" cy="55" r="8" fill="#4A3426"/><circle cx="46" cy="51" r="2.5" fill="#FAF5EC"/><rect x="72" y="37" width="9" height="6" rx="2" fill="#EAD9A8"/>` },
  music: { label: "music", svg: `<path d="M38 70 V26 L78 18 V62" fill="none" ${K} stroke-width="3.5"/><path d="M38 34 L78 26" fill="none" ${K} stroke-width="3.5"/><ellipse cx="30" cy="70" rx="10" ry="8" fill="#4A3426"/><ellipse cx="70" cy="62" rx="10" ry="8" fill="#4A3426"/>` },
  coffee: { label: "coffee", svg: `<path d="M40 14 C36 20 44 24 40 30 M54 12 C50 18 58 22 54 28" fill="none" ${K}/><path d="M72 46 C88 46 88 66 72 66" fill="none" ${K} stroke-width="4"/><path d="M22 38 H74 V64 C74 78 62 86 48 86 C34 86 22 78 22 64Z" fill="#FAF5EC" ${K}/><path d="M48 70 C40 64 38 60 39 57 C40 54 44 53 48 57 C52 53 56 54 57 57 C58 60 56 64 48 70Z" fill="#D6A39D"/>` },
  strawberry: { label: "strawberry", svg: `<path d="M50 88 C26 76 18 52 28 40 C36 30 64 30 72 40 C82 52 74 76 50 88Z" fill="#D98A84" ${K}/><path d="M50 36 L40 24 L50 29 L52 16 L56 29 L66 24 Z" fill="#AAB597" ${K}/>` + [[38, 50], [52, 48], [64, 52], [44, 62], [58, 64], [50, 76]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.8" ry="3" fill="#EAD9A8"/>`).join("") },
  lemon: { label: "lemon slice", svg: `<circle cx="50" cy="50" r="38" fill="#EAD9A8" ${K}/><circle cx="50" cy="50" r="30" fill="#F6ECC6"/>` + [0, 45, 90, 135].map((a) => `<path d="M50 22 L50 78" transform="rotate(${a} 50 50)" stroke="#FAF5EC" stroke-width="3"/>`).join("") + `<circle cx="50" cy="50" r="4" fill="#FAF5EC"/>` },
  tulip: { label: "tulip", svg: `<path d="M50 60 V92" fill="none" ${K}/><path d="M50 84 C40 70 30 72 26 64 C38 62 46 70 50 80Z" fill="#AAB597" ${K}/><path d="M32 22 L41 40 L50 18 L59 40 L68 22 C71 48 64 60 50 60 C36 60 29 48 32 22Z" fill="#D6A39D" ${K}/>` },
  smiley: { label: "smiley", svg: `<circle cx="50" cy="50" r="38" fill="#EAD9A8" ${K}/><ellipse cx="38" cy="42" rx="3.5" ry="5.5" fill="#4A3426"/><ellipse cx="62" cy="42" rx="3.5" ry="5.5" fill="#4A3426"/><path d="M34 60 C42 72 58 72 66 60" fill="none" ${K} stroke-width="3.5"/><circle cx="30" cy="58" r="5" fill="#D6A39D" opacity=".6"/><circle cx="70" cy="58" r="5" fill="#D6A39D" opacity=".6"/>` },
  pin: { label: "push pin", svg: `<path d="M50 50 L50 90" stroke="#8C8279" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="34" r="20" fill="#D6A39D" ${K}/><circle cx="43" cy="27" r="5" fill="#FAF5EC" opacity=".8"/>` },
  clip: { label: "paperclip", svg: `<path d="M40 18 V70 A10 10 0 0 0 60 70 V26 A6 6 0 0 0 48 26 V64" fill="none" stroke="#9C938A" stroke-width="5" stroke-linecap="round"/>` },
};

// Washi tape strips, used as stickers.
export const TAPES = [
  { key: "stripes", label: "stripes" }, { key: "gingham", label: "gingham" }, { key: "dots", label: "dots" },
  { key: "floral", label: "floral" }, { key: "plain", label: "plain" },
];
export const washi = (pattern, color) => `<div class="washi p-${esc(pattern)}" style="--c:${esc(color)}"></div>`;

// One-tap word stickers.
export const PRESET_WORDS = ["bff", "core memory", "iconic", "love you", "hbd!", "best day ever", "miss you", "us ♡", "the group chat", "no thoughts just vibes"];

// Book themes: page colors and the gingham tint. Applied as a class on the book.
export const THEMES = [
  { key: "kraft", label: "kraft", swatch: "#C9A77E" },
  { key: "blush", label: "blush", swatch: "#EBC8C2" },
  { key: "noir", label: "noir", swatch: "#2B2624" },
  { key: "sky", label: "sky", swatch: "#C9D7E0" },
  { key: "sage", label: "sage", swatch: "#CDD5BC" },
];
export const doodleSvg = (k) => { const d = DOODLES[k] || DOODLES.heart; return d.raw ? d.raw() : `<svg viewBox="0 0 100 100" aria-hidden="true">${d.svg}</svg>`; };
export const TAPE_COLORS = ["#D6A39D", "#AAB597", "#EAD9A8", "#BFB3CF", "#E3C1B4"];

export function wordInner(st) {
  if (st.style === "ransom") {
    return `<div class="w-ransom">${[...st.text].map((ch, i) => ch === " " ? '<span class="sp"></span>'
      : `<span class="r${(hash(st.id) + i * 3) % 5}" style="transform:rotate(${(hash(st.id + i) % 11) - 5}deg)">${esc(ch)}</span>`).join("")}</div>`;
  }
  if (st.style === "tape") return `<div class="w-tape" style="--c:${esc(st.color || TAPE_COLORS[0])}">${esc(st.text)}</div>`;
  return `<div class="w-label">${esc(st.text)}</div>`;
}

export const ransomWord = (word, seed) =>
  `<div class="ransom">${[...word].map((ch, i) => `<span class="r${(seed + i * 2) % 5}" style="transform:rotate(${((seed * 7 + i * 5) % 11) - 5}deg)">${esc(ch)}</span>`).join("")}</div>`;
export const ransomTitle = (title) =>
  String(title || "").trim().split(/\s+/).filter(Boolean).slice(0, 4).map((w, i) => ransomWord(w.slice(0, 12), 1 + i * 3)).join("");

// ───────── page layouts ─────────
// ctx.ed(path, value, tag, placeholder) → editable text; ctx.img(ref, aspect, path) → photo frame;
// ctx.meta() → the book's cover details. Paths starting with "meta." belong to the book itself.
export function layouts(ctx) {
  const { ed, img } = ctx;
  const m = () => ctx.meta() || {};
  const tape = (style, c) => `<span class="tape" style="${style};--c:${c}"></span>`;
  const label = (path, text, style, light) => `<div class="label${light ? " light" : ""}" style="${style}">${ed(path, text, "span", "label")}</div>`;
  const scrap = (path, text, style) => `<div class="scrap" style="${style}">${ed(path, text, "span", "a little note")}</div>`;
  const ph = (p, i) => (p.photos || {})[i] || {};

  return {
    cover: () => `
      <div class="floral" style="left:-6%;bottom:-4%;width:52%;height:24%;transform:rotate(5deg)"></div>
      ${tape("left:58%;bottom:17%;transform:rotate(-24deg)", "#AAB597")}
      <div class="bow" style="right:9%;top:7%;width:22%;transform:rotate(8deg)">${bowSvg("bw")}</div>
      <div class="cover-title">
        <button class="ransom-wrap" type="button" title="Change the title">${ransomTitle(m().title || "happy birthday")}</button>
        <div class="label cover-for" style="position:relative">${ed("meta.name", m().name, "span", "a line under the title")}</div>
        <div class="cover-date">${ed("meta.date", m().date, "span", "the date")}</div>
      </div>`,
    back: () => `
      <div class="gingham" style="right:-4%;top:-3%;width:40%;height:20%;transform:rotate(-6deg)"></div>
      <div class="bow" style="left:39%;top:36%;width:22%">${bowSvg("rw")}</div>
      <div class="label" style="left:50%;top:56%;transform:translateX(-50%) rotate(-2deg)">made with love by ${ed("meta.from", m().from, "span", "your friends")}</div>
      <div class="cover-date" style="position:absolute;left:0;right:0;top:66%;text-align:center">stuck together ♡</div>`,
    letter: (p) => `
      <div class="letter" style="transform:rotate(-1.2deg)">
        ${ed("title", p.title, "h3", "a title")}
        ${ed("text", p.text, "p", "write your letter here")}
        <div class="sign">love, ${ed("sign", p.sign, "span", "you")}</div>
      </div>
      ${tape("left:4%;top:12%;transform:rotate(-38deg)", "#D6A39D")}
      ${tape("right:4%;bottom:11%;transform:rotate(-38deg)", "#AAB597")}
      ${label("label", p.label, "left:9%;top:6%;transform:rotate(-2deg)")}
      <div class="floral" style="right:-5%;top:-3%;width:30%;height:14%;transform:rotate(7deg)"></div>`,
    polaroid: (p) => `
      <div class="gingham" style="left:11%;top:14%;width:76%;height:58%;transform:rotate(3.5deg)"></div>
      <figure class="photo mat" style="left:17%;top:19%;width:64%;transform:rotate(-2deg)">${img(p.photo, 1, "photo")}</figure>
      <div class="bow" style="left:37%;top:10%;width:26%">${bowSvg("bw")}</div>
      ${label("label", p.label, "left:7%;top:5.5%;transform:rotate(-2deg)")}
      ${label("photo.caption", (p.photo || {}).caption, "right:9%;top:69%;transform:rotate(2deg)", true)}
      ${scrap("note", p.note, "left:12%;top:79%;max-width:74%;transform:rotate(-1.5deg)")}`,
    duo: (p) => {
      const a = ph(p, 0), b = ph(p, 1), c = p.clipping || {};
      return `
      <div class="floral" style="left:-4%;bottom:3%;width:34%;height:18%;transform:rotate(-5deg)"></div>
      <figure class="photo polaroid" style="left:8%;top:13%;width:50%;transform:rotate(-4deg)">${img(a, 1, "photos.0")}<figcaption>${ed("photos.0.caption", a.caption, "span", "caption")}</figcaption></figure>
      ${tape("left:21%;top:10.5%;transform:rotate(-8deg)", "#D6A39D")}
      <div class="clipping" style="right:6%;top:18%;width:40%;transform:rotate(3deg)">${ed("clipping.headline", c.headline, "h4", "headline")}${ed("clipping.text", c.text, "p", "the story")}</div>
      <figure class="photo bordered" style="right:9%;top:58%;width:47%;transform:rotate(3deg)">
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>${img(b, 1.25, "photos.1")}</figure>
      ${label("photos.1.caption", b.caption, "left:10%;top:80%;transform:rotate(-3deg)", true)}
      ${label("label", p.label, "left:8%;top:5%;transform:rotate(-1.5deg)")}`;
    },
    collage: (p) => `
      <div class="gingham" style="left:-3%;top:63%;width:106%;height:13%;transform:rotate(-2.5deg)"></div>
      <figure class="photo bordered" style="left:7%;top:12%;width:50%;transform:rotate(-3deg)">${img(ph(p, 0), 0.8, "photos.0")}</figure>
      <figure class="photo bordered" style="right:7%;top:21%;width:43%;transform:rotate(4deg)">${img(ph(p, 1), 1, "photos.1")}</figure>
      <figure class="photo bordered" style="left:34%;top:51%;width:50%;transform:rotate(-1.5deg)">${img(ph(p, 2), 1.25, "photos.2")}</figure>
      ${tape("left:50%;top:49%;transform:rotate(6deg)", "#EAD9A8")}
      ${tape("right:14%;top:18.5%;transform:rotate(-10deg)", "#BFB3CF")}
      ${label("label", p.label, "right:8%;top:6%;transform:rotate(2deg)")}
      ${scrap("note", p.note, "left:7%;top:84%;max-width:60%;transform:rotate(-2deg)")}`,
    list: (p) => {
      const items = p.items || {};
      const keys = Object.keys(items).sort((a, b) => a - b);
      return `
      <div class="list-card" style="transform:rotate(1deg)">
        <ul>${keys.map((k) => ed("items." + k, items[k], "li", "one more thing")).join("")}</ul>
        ${keys.length < 12 ? `<button class="add-item" type="button" data-next="${keys.length ? Math.max(...keys.map(Number)) + 1 : 0}">+ add one</button>` : ""}
      </div>
      ${tape("left:39%;top:12%;transform:rotate(-3deg)", "#AAB597")}
      ${label("label", p.label, "left:12%;top:17.5%;transform:rotate(-2deg)")}
      <div class="gingham" style="right:-5%;bottom:-3%;width:28%;height:14%;transform:rotate(-8deg)"></div>`;
    },
    blank: (p) => `
      ${label("label", p.label, "left:8%;top:6%;transform:rotate(-2deg)")}
      <div class="blank-hint">${ed("hint", p.hint, "span", "a page for stickers ♡")}</div>`,
    film: (p) => `
      <div class="filmstrip" style="left:9%;top:6%;width:44%;bottom:6%;transform:rotate(-2deg)">
        ${[0, 1, 2].map((i) => `<div class="frame">${img(ph(p, i), 1.3, "photos." + i)}</div>`).join("")}
      </div>
      ${label("label", p.label, "right:6%;top:10%;transform:rotate(3deg)")}
      ${tape("left:22%;top:3%;transform:rotate(4deg)", "#BFB3CF")}
      <div class="scrap" style="right:7%;top:32%;width:34%;transform:rotate(2deg)">${ed("note", p.note, "span", "what happened here")}</div>
      <div class="floral" style="right:-4%;bottom:-3%;width:36%;height:20%;transform:rotate(-6deg)"></div>`,
    grid: (p) => `
      ${label("label", p.label, "left:8%;top:5%;transform:rotate(-2deg)")}
      <div class="photo-grid">
        ${[0, 1, 2, 3].map((i) => `<figure class="photo polaroid small" style="transform:rotate(${[-3, 2, 2.5, -2][i]}deg)">${img(ph(p, i), 1, "photos." + i)}<figcaption>${ed("photos." + i + ".caption", ph(p, i).caption, "span", "caption")}</figcaption></figure>`).join("")}
      </div>
      ${tape("left:42%;top:12%;transform:rotate(-3deg)", "#EAD9A8")}`,
    ticket: (p) => {
      const t = p.ticket || {};
      return `
      <div class="ticket" style="left:8%;right:8%;top:10%;transform:rotate(-2deg)">
        <div class="ticket-main">
          <div class="ticket-head">${ed("ticket.title", t.title, "span", "admit two")}</div>
          <div class="ticket-row"><small>from</small>${ed("ticket.from", t.from, "b", "here")}<small>to</small>${ed("ticket.to", t.to, "b", "there")}</div>
          <div class="ticket-row"><small>date</small>${ed("ticket.date", t.date, "b", "the day")}</div>
        </div>
        <div class="ticket-stub"><small>no.</small><b>${String(1000 + (hash(p.id || "t") % 9000))}</b></div>
      </div>
      <figure class="photo bordered" style="left:14%;top:40%;width:58%;transform:rotate(2deg)">${img(p.photo, 1.25, "photo")}</figure>
      ${tape("left:36%;top:37.5%;transform:rotate(-6deg)", "#D6A39D")}
      ${label("label", p.label, "right:7%;top:3.5%;transform:rotate(2deg)")}
      <div class="scrap" style="right:6%;top:80%;max-width:60%;transform:rotate(-2deg)">${ed("note", p.note, "span", "the best part was…")}</div>`;
    },
    notes: (p) => {
      const notes = p.notes || {};
      const keys = Object.keys(notes).sort((a, b) => a - b);
      const colors = ["#F6E7B4", "#EED6CF", "#DCE0CF", "#D8E1EA", "#E5DDF0", "#F3DCC8"];
      return `
      ${label("label", p.label, "left:8%;top:5%;transform:rotate(-2deg)")}
      <div class="notes-wall">
        ${keys.map((k, i) => `<div class="sticky" style="--bg:${colors[i % colors.length]};transform:rotate(${[-3, 2, -1.5, 3, -2.5, 1.5][i % 6]}deg)">
          <span class="pin"></span>
          ${ed("notes." + k + ".text", (notes[k] || {}).text, "p", "write something")}
          <div class="by">— ${ed("notes." + k + ".by", (notes[k] || {}).by, "span", "you")}</div>
        </div>`).join("")}
        ${keys.length < 6 ? `<button class="add-note" type="button" data-next="${keys.length ? Math.max(...keys.map(Number)) + 1 : 0}">+ leave a note</button>` : ""}
      </div>`;
    },
    quote: (p) => `
      <div class="quote-paper" style="left:9%;right:9%;top:12%;transform:rotate(-1.5deg)">
        <span class="quote-mark">“</span>
        ${ed("quote", p.quote, "p", "something someone said that you'll never forget")}
        <div class="quote-who">— ${ed("who", p.who, "span", "who said it")}</div>
      </div>
      <figure class="photo polaroid" style="right:10%;top:56%;width:40%;transform:rotate(5deg)">${img(p.photo, 1, "photo")}<figcaption>${ed("photo.caption", (p.photo || {}).caption, "span", "caption")}</figcaption></figure>
      ${tape("right:20%;top:54%;transform:rotate(-4deg)", "#AAB597")}
      ${label("label", p.label, "left:8%;top:5%;transform:rotate(-2deg)")}
      <div class="gingham" style="left:-4%;bottom:-3%;width:40%;height:18%;transform:rotate(5deg)"></div>`,
    pad: () => `<div class="blank-hint"><span>♡</span></div>`,
  };
}

// What someone picks from when they add a page.
export const PAGE_TYPES = [
  { type: "letter", name: "letter", desc: "a note on lined paper" },
  { type: "polaroid", name: "one photo", desc: "a framed photo with a bow and a note" },
  { type: "duo", name: "two photos", desc: "two photos and a newspaper clipping" },
  { type: "collage", name: "three photos", desc: "an overlapping photo collage" },
  { type: "list", name: "list", desc: "reasons, memories, inside jokes" },
  { type: "blank", name: "blank page", desc: "an empty page to cover in stickers" },
  { type: "film", name: "film strip", desc: "three photos on a strip of film" },
  { type: "grid", name: "photo grid", desc: "four little polaroids with captions" },
  { type: "ticket", name: "ticket stub", desc: "a trip or a concert, with a photo" },
  { type: "notes", name: "notes wall", desc: "sticky notes, one from each friend" },
  { type: "quote", name: "quote", desc: "something someone said, with a photo" },
];

export function freshPage(type) {
  switch (type) {
    case "film": return { type, label: "", photos: { 0: {}, 1: {}, 2: {} }, note: "" };
    case "grid": return { type, label: "", photos: { 0: { caption: "" }, 1: { caption: "" }, 2: { caption: "" }, 3: { caption: "" } } };
    case "ticket": return { type, label: "", ticket: { title: "", from: "", to: "", date: "" }, photo: {}, note: "" };
    case "notes": return { type, label: "notes from everyone", notes: { 0: { text: "", by: "" }, 1: { text: "", by: "" } } };
    case "quote": return { type, label: "", quote: "", who: "", photo: { caption: "" } };
    case "letter": return { type, label: "a little letter", title: "dear you,", text: "", sign: "" };
    case "polaroid": return { type, label: "", photo: { caption: "" }, note: "" };
    case "duo": return { type, label: "", photos: { 0: { caption: "" }, 1: { caption: "" } }, clipping: { headline: "", text: "" } };
    case "collage": return { type, label: "", photos: { 0: {}, 1: {}, 2: {} }, note: "" };
    case "list": return { type, label: "", items: { 0: "", 1: "", 2: "" } };
    default: return { type: "blank", label: "", hint: "" };
  }
}

// What a scrapbook can be about. Each kind starts with its own set of pages.
export const KINDS = [
  { key: "person", label: "a person", desc: "a birthday, a goodbye, a thank you" },
  { key: "trip", label: "a trip", desc: "a weekend away, a road trip, a holiday" },
  { key: "year", label: "a year or season", desc: "2026, last summer, senior year" },
  { key: "us", label: "just us", desc: "an ongoing book for the group" },
];

const items = (...xs) => Object.fromEntries(xs.map((x, i) => [i, x]));
const photos = (n, caption = "") => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { caption }]));
const notesWall = (label) => ({ type: "notes", label, notes: { 0: { text: "", by: "" }, 1: { text: "", by: "" } } });

// Pages every new book starts with, by kind.
export function starterPages(kind = "person") {
  if (kind === "trip") return [
    { type: "ticket", label: "where it all started", ticket: { title: "admit all of us", from: "", to: "", date: "" }, photo: {}, note: "" },
    { type: "film", label: "on the road", photos: photos(3), note: "" },
    { type: "grid", label: "the whole trip", photos: photos(4) },
    { type: "list", label: "things we ate", items: items("", "", "") },
    { type: "duo", label: "core memory", photos: photos(2), clipping: { headline: "travellers refuse to go home", text: "" } },
    { type: "quote", label: "said on the trip", quote: "", who: "", photo: { caption: "" } },
    notesWall("best part of the trip"),
    { type: "blank", label: "souvenirs", hint: "stick your favorite things here ♡" },
  ];
  if (kind === "year") return [
    { type: "letter", label: "dear future us", title: "this year,", text: "", sign: "all of us" },
    { type: "grid", label: "highlights", photos: photos(4) },
    { type: "film", label: "on repeat", photos: photos(3), note: "" },
    { type: "list", label: "best moments", items: items("", "", "") },
    { type: "collage", label: "the archive", photos: photos(3), note: "" },
    { type: "quote", label: "quote of the year", quote: "", who: "", photo: { caption: "" } },
    notesWall("one word for this year"),
    { type: "blank", label: "and everything else", hint: "" },
  ];
  if (kind === "us") return [
    { type: "letter", label: "how it started", title: "once upon a time,", text: "", sign: "us" },
    { type: "grid", label: "the group", photos: photos(4) },
    { type: "film", label: "a normal day", photos: photos(3), note: "" },
    { type: "list", label: "inside jokes", items: items("", "", "") },
    { type: "duo", label: "certified iconic", photos: photos(2), clipping: { headline: "local friends still not over it", text: "" } },
    { type: "quote", label: "said in the group chat", quote: "", who: "", photo: { caption: "" } },
    notesWall("notes from everyone"),
    { type: "blank", label: "to be continued", hint: "add a page whenever something happens ♡" },
  ];
  return [
    { type: "letter", label: "open me first", title: "dear you,", text: "we made you a little book of us, because a card wasn't enough. flip through, add stickers, and make it yours.", sign: "all of us" },
    { type: "polaroid", label: "main character energy", photo: { caption: "" }, note: "" },
    { type: "duo", label: "certified iconic", photos: photos(2), clipping: { headline: "local friends still not over it", text: "sources confirm the group laughed so hard nobody else understood the joke." } },
    { type: "collage", label: "the archive", photos: photos(3), note: "blurry, chaotic, perfect" },
    { type: "list", label: "reasons you're our favorite", items: items("", "", "") },
    { type: "film", label: "on repeat", photos: photos(3), note: "" },
    notesWall("notes from everyone"),
    { type: "blank", label: "sign here", hint: "everyone leave a sticker ♡" },
  ];
}
