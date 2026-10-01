// Firebase setup shared by every page: sign-in, profiles, and Firestore helpers.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch,
  serverTimestamp, query, orderBy, where, getDocs, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch,
  serverTimestamp, query, orderBy, where, getDocs, arrayUnion, arrayRemove,
};

export const configured = Boolean(firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE"));

const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/** Calls back with the signed-in user (or null) now and whenever it changes. */
export function onUser(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, provider);
  await saveProfile(user);
  return user;
}

const EMAIL_KEY = "stuck-together:email-for-signin";
/** Emails a one-tap sign-in link. It lands on the home page, which forwards to `next`
 *  (the book or invite they were opening), because a #fragment doesn't survive the email hop. */
export async function sendEmailLink(email) {
  const here = location.pathname + location.hash;
  const url = location.origin + "/" + (here.startsWith("/b#") ? "?next=" + encodeURIComponent(here) : "");
  await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
  try { localStorage.setItem(EMAIL_KEY, email); } catch (_) {}
}
/** Finishes an email-link sign-in if this page was opened from one. */
export async function finishEmailLink(askEmail) {
  if (!auth || !isSignInWithEmailLink(auth, location.href)) return null;
  let email = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch (_) {}
  if (!email) email = await askEmail();
  if (!email) return null;
  const { user } = await signInWithEmailLink(auth, email, location.href);
  try { localStorage.removeItem(EMAIL_KEY); } catch (_) {}
  const next = new URLSearchParams(location.search).get("next");
  history.replaceState(null, "", location.pathname + (next ? "?next=" + encodeURIComponent(next) : "") + location.hash);
  await saveProfile(user);
  return user;
}

export const signOut = () => fbSignOut(auth);

/** Creates or refreshes users/{uid}, the name and picture friends see. */
export async function saveProfile(user, name) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : {};
  const next = {
    name: (name ?? current.name ?? user.displayName ?? (user.email || "").split("@")[0] ?? "").slice(0, 60) || "a friend",
    photo: user.photoURL || current.photo || "",
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, next);
  if (name && auth.currentUser) await updateProfile(auth.currentUser, { displayName: next.name }).catch(() => {});
  return next;
}

const profileCache = new Map();
/** Looks up friends' names and pictures, with a small cache. */
export async function profiles(uids) {
  const out = {};
  await Promise.all([...new Set(uids)].map(async (uid) => {
    if (!profileCache.has(uid)) {
      profileCache.set(uid, getDoc(doc(db, "users", uid)).then((s) => (s.exists() ? s.data() : { name: "a friend", photo: "" })).catch(() => ({ name: "a friend", photo: "" })));
    }
    out[uid] = await profileCache.get(uid);
  }));
  return out;
}

/** Unguessable ids: 22 chars (~128 bits) for books and invite codes, shorter inside a book. */
export function newId(len = 22) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
