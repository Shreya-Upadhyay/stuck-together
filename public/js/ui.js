// Small UI pieces shared by the home page and the book: toasts, avatars,
// the sign-in panel and the account menu.
import { configured, signInWithGoogle, sendEmailLink, finishEmailLink, signOut, saveProfile, profiles } from "./db.js";
import { esc, hash } from "./art.js";

export const $ = (id) => document.getElementById(id);

let toastTimer;
export function toast(msg) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3800);
}

const AVATAR_BG = ["#D6A39D", "#AAB597", "#EAD9A8", "#BFB3CF", "#E3C1B4", "#A9B8C9"];
export function avatar(p, uid, size = 32) {
  const name = (p && p.name) || "a friend";
  const initial = esc(name.trim()[0] || "♡").toUpperCase();
  const img = p && p.photo ? `<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer">` : "";
  return `<span class="avatar" style="--size:${size}px;--bg:${AVATAR_BG[hash(uid || name) % AVATAR_BG.length]}" title="${esc(name)}">${img || initial}</span>`;
}

/** Fills `el` with the sign-in panel. `why` explains what signing in unlocks. */
export function renderSignIn(el, why) {
  if (!configured) {
    el.innerHTML = `<p class="form-note">this site isn't connected to Firebase yet. add your config to <code>public/js/firebase-config.js</code> (see the README).</p>`;
    return;
  }
  el.innerHTML = `
    <div class="signin">
      <p class="signin-why">${esc(why)}</p>
      <button class="pill primary big" type="button" data-google>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        continue with Google</button>
      <div class="or"><span>or</span></div>
      <form class="email-form" data-email>
        <label class="field" for="signin-email">get a sign-in link by email
          <input id="signin-email" type="email" required placeholder="you@example.com" autocomplete="email"></label>
        <button class="pill" type="submit">email me a link</button>
      </form>
      <p class="form-note" data-note>no passwords. your name and picture are shown to friends in your scrapbooks.</p>
    </div>`;
  el.querySelector("[data-google]").onclick = async () => {
    try { await signInWithGoogle(); }
    catch (e) {
      if (e && e.code === "auth/popup-closed-by-user") return;
      console.error(e);
      toast(e && e.code === "auth/unauthorized-domain"
        ? "this site's address isn't allowed in Firebase yet (Authentication → Settings → Authorized domains)."
        : "couldn't sign in with Google. try again, or use the email link.");
    }
  };
  el.querySelector("[data-email]").onsubmit = async (e) => {
    e.preventDefault();
    const email = el.querySelector("#signin-email").value.trim();
    try {
      await sendEmailLink(email);
      el.querySelector("[data-note]").textContent = `sent! open the link we emailed to ${email} on this device. check spam if it's not there.`;
    } catch (err) { console.error(err); toast("couldn't send the email. check the address and try again."); }
  };
}

/** Completes an email-link sign-in, asking for the address if this device doesn't remember it. */
export function handleEmailLink() {
  return finishEmailLink(async () => window.prompt("which email did you use to sign in?")).catch((e) => {
    console.error(e); toast("that sign-in link didn't work. it may be old; ask for a new one."); return null;
  });
}

/** The avatar button in the top bar, with name editing and sign out. */
export async function renderAccount(el, user) {
  if (!user) { el.innerHTML = ""; return; }
  const p = (await profiles([user.uid]))[user.uid] || { name: user.displayName || "you", photo: user.photoURL };
  el.innerHTML = `<button class="account-btn" type="button" aria-haspopup="true" aria-expanded="false">${avatar(p, user.uid, 34)}</button>
    <div class="popover account-menu" hidden>
      <p class="account-who">signed in as <b>${esc(p.name)}</b></p>
      <form class="account-name"><label class="field" for="acct-name">your name <input id="acct-name" maxlength="60" value="${esc(p.name)}"></label><button class="pill" type="submit">save</button></form>
      <button class="menu-item" type="button" data-signout>sign out</button>
    </div>`;
  const btn = el.querySelector(".account-btn"), menu = el.querySelector(".account-menu");
  btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !el.contains(e.target)) menu.hidden = true; });
  el.querySelector(".account-name").onsubmit = async (e) => {
    e.preventDefault();
    const name = el.querySelector("#acct-name").value.trim(); if (!name) return;
    try { await saveProfile(user, name); toast("name saved"); menu.hidden = true; location.reload(); }
    catch (err) { console.error(err); toast("couldn't save your name."); }
  };
  el.querySelector("[data-signout]").onclick = async () => { await signOut(); location.href = "/"; };
}
