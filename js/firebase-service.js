import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { defaultWorkspace } from './defaults.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const settingsRef = (uid) => doc(db, 'users', uid, 'settings', 'profile');
const workspaceRef = (uid) => doc(db, 'users', uid, 'workspace', 'main');

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function loadSettings(uid) {
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) {
    const defaults = { repName: '', theme: 'light' };
    await setDoc(settingsRef(uid), defaults, { merge: true });
    return defaults;
  }
  return { repName: '', theme: 'light', ...snap.data() };
}

export async function saveSettings(uid, settings) {
  await setDoc(settingsRef(uid), settings, { merge: true });
}

export async function loadWorkspace(uid) {
  const snap = await getDoc(workspaceRef(uid));
  if (!snap.exists()) {
    await setDoc(workspaceRef(uid), defaultWorkspace, { merge: false });
    return structuredClone(defaultWorkspace);
  }
  return snap.data();
}

export async function saveWorkspace(uid, workspace) {
  await setDoc(workspaceRef(uid), workspace, { merge: false });
}
