import { db, onUser, newId, profiles, doc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "./db.js";
import { esc, hash, ransomTitle, bowSvg, starterPages, THEMES, KINDS } from "./art.js";
import { $, toast, avatar, renderSignIn, renderAccount, handleEmailLink } from "./ui.js";

$("hero-title").innerHTML = ransomTitle("stuck together");
$("hero-bow").innerHTML = bowSvg("bw");

const OCCASIONS = [
  ["birthday", "happy birthday"], ["goodbye", "miss you already"], ["graduation", "congrats grad"],
  ["thank you", "thank you"], ["anniversary", "happy anniversary"], ["just because", "just because"],
];
const form = { kind: "person", title: OCCASIONS[0][1], theme: "kraft" };

// After an email-link sign-in, carry on to the book or invite they were opening.
// Only book links are allowed here, so the page can't be used to redirect elsewhere.
const next = new URLSearchParams(location.search).get("next");
const safeNext = next && /^\/b#[A-Za-z0-9.]{16,90}$/.test(next) ? next : null;

let me = null;
handleEmailLink();
onUser(async (user) => {
  me = user;
  if (user && safeNext) { location.replace(safeNext); return; }
  $("signed-out").hidden = !!user;
  $("signed-in").hidden = !user;
  renderAccount($("account"), user);
  if (!user) { renderSignIn($("signin"), "sign in to start a scrapbook, or to open one a friend invited you to."); return; }
  loadShelf();
});

async function loadShelf() {
  const shelf = $("shelf");
  shelf.innerHTML = `<p class="empty-shelf">finding your scrapbooks…</p>`;
  let books = [];
  try {
    const snap = await getDocs(query(collection(db, "books"), where("members", "array-contains", me.uid)));
    books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); shelf.innerHTML = `<p class="empty-shelf">couldn't load your scrapbooks. reload to try again.</p>`; return; }
  books.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  const people = await profiles(books.flatMap((b) => b.members.slice(0, 4)));
  shelf.innerHTML = `<button class="new-book" id="new-book" type="button">+ new scrapbook<span>for a person, a trip, a year, or the group</span></button>` +
    books.map((b) => `
      <a class="mini-cover theme-${esc(b.theme || "kraft")}" href="/b#${esc(b.id)}" style="--rot:${(hash(b.id) % 5) - 2}deg">
        <div class="ransom-title">${ransomTitle(b.title || "a scrapbook")}</div>
        ${b.name ? `<div class="for">${esc(b.name)}</div>` : ""}
        <div class="avatars">${b.members.slice(0, 4).map((u) => avatar(people[u], u, 26)).join("")}</div>
      </a>`).join("") +
    (books.length ? "" : `<p class="empty-shelf" style="align-self:center">no scrapbooks yet. start one, or open an invite link from a friend.</p>`);
  $("new-book").onclick = openNew;
}

// ───────── new scrapbook ─────────
// Each kind asks one or two questions and turns the answers into the cover.
const FIELDS = {
  person: () => `
    <label class="field" for="n-a">who's it for?<input id="n-a" maxlength="40" placeholder="their name" required autocomplete="off"></label>
    <fieldset class="field"><legend>the occasion</legend><div class="chips" id="occasions"></div>
      <input id="n-b" maxlength="48" placeholder="or write your own title" aria-label="Your own title" autocomplete="off"></fieldset>`,
  trip: () => `
    <label class="field" for="n-a">where to?<input id="n-a" maxlength="40" placeholder="goa" required autocomplete="off"></label>
    <label class="field" for="n-b">when? <span class="hint">optional</span><input id="n-b" maxlength="40" placeholder="may 2026" autocomplete="off"></label>`,
  year: () => `
    <label class="field" for="n-a">which year or season?<input id="n-a" maxlength="40" placeholder="summer 2026" required autocomplete="off"></label>`,
  us: () => `
    <label class="field" for="n-a">what do you call yourselves?<input id="n-a" maxlength="40" placeholder="the group chat" required autocomplete="off"></label>`,
};
// Turns the answers into { title, name, date }: the cut-out title, the line under it, and the small date.
function coverFrom(kind) {
  const a = ($("n-a") || {}).value?.trim() || "", b = ($("n-b") || {}).value?.trim() || "";
  if (kind === "trip") return { title: a, name: b || "a trip", date: "" };
  if (kind === "year") return { title: a, name: "a year in pictures", date: "" };
  if (kind === "us") return { title: a, name: "est. " + new Date().getFullYear(), date: "" };
  return { title: b || form.title, name: "for " + a, date: "" };
}
function renderOccasions() {
  const box = $("occasions"); if (!box) return;
  const custom = $("n-b").value.trim();
  box.innerHTML = OCCASIONS.map(([k, t]) => `<button type="button" class="chip" data-t="${esc(t)}" aria-pressed="${!custom && form.title === t}">${esc(k)}</button>`).join("");
  box.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { form.title = b.dataset.t; $("n-b").value = ""; renderOccasions(); }));
}
function renderForm() {
  $("kinds").innerHTML = KINDS.map((k) => `<button type="button" class="kind-card" data-kind="${k.key}" aria-pressed="${form.kind === k.key}"><b>${k.label}</b><span>${k.desc}</span></button>`).join("");
  $("kinds").querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => {
    if (form.kind === b.dataset.kind) return;
    form.kind = b.dataset.kind; renderForm(); $("n-a").focus();
  }));
  $("kind-fields").innerHTML = FIELDS[form.kind]();
  if (form.kind === "person") { $("n-b").addEventListener("input", renderOccasions); renderOccasions(); }
  renderThemes();
}
function renderThemes() {
  $("themes").innerHTML = THEMES.map((t) => `<button type="button" class="swatch" data-theme="${t.key}" aria-pressed="${form.theme === t.key}"><i style="--sw:${t.swatch}"></i>${t.label}</button>`).join("");
  $("themes").querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => { form.theme = b.dataset.theme; renderThemes(); }));
}
function openNew() { renderForm(); $("new-sheet").hidden = false; $("n-a").focus(); }
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => ($("new-sheet").hidden = true)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("new-sheet").hidden = true; });

$("new-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!me) return;
  if (!$("n-a").value.trim()) { $("n-a").focus(); return; }
  const cover = coverFrom(form.kind);
  const btn = $("new-btn"); btn.disabled = true; btn.textContent = "making it…";
  try {
    const id = newId(22);
    const mine = (await profiles([me.uid]))[me.uid];
    const batch = writeBatch(db);
    batch.set(doc(db, "books", id), {
      ...cover, kind: form.kind, from: (mine && mine.name) || "your friends",
      theme: form.theme, owner: me.uid, members: [me.uid], inviteCode: newId(22), createdAt: serverTimestamp(),
    });
    starterPages(form.kind).forEach((p, i) => batch.set(doc(db, "books", id, "pages", newId(16)), { ...p, order: i }));
    await batch.commit();
    location.href = "/b#" + id;
  } catch (err) {
    console.error(err);
    btn.disabled = false; btn.textContent = "make it";
    toast("couldn't make the scrapbook. check your connection and try again.");
  }
});
