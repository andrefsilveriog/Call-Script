import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { buildSeedWorkspace, DEFAULT_GROUPS } from "./defaults.js";

let app = null;
let auth = null;
let db = null;

function ensureFirebase() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured yet. Add your project's web config to js/firebase-config.js.");
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth, db };
}

function settingsRef(uid) {
  return doc(db, "users", uid, "meta", "settings");
}

function flowsCollection(uid) {
  return collection(db, "users", uid, "flows");
}

function stepsCollection(uid, flowId) {
  return collection(db, "users", uid, "flows", flowId, "steps");
}

function sanitizeGroup(group, index) {
  return {
    id: group.id,
    name: group.name || "New Group",
    icon: group.icon || "🗂️",
    order: Number.isFinite(group.order) ? group.order : index,
  };
}

function sanitizeFlow(flow, index, fallbackGroupId) {
  return {
    id: flow.id,
    name: flow.name || "Untitled Flow",
    icon: flow.icon || "📞",
    desc: flow.desc || "",
    groupId: flow.groupId || fallbackGroupId,
    order: Number.isFinite(flow.order) ? flow.order : index,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeStep(step, index) {
  return {
    id: step.id,
    num: step.num || "",
    label: step.label || "Untitled",
    title: step.title || "Untitled Step",
    subtitle: step.subtitle || "",
    script: step.script || "",
    toneCue: step.toneCue || "",
    keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints : [],
    branches: Array.isArray(step.branches) ? step.branches : [],
    main: Boolean(step.main),
    special: Boolean(step.special),
    specialType: step.specialType || null,
    parentId: step.parentId || null,
    next: step.next || null,
    guarantees: Array.isArray(step.guarantees) ? step.guarantees : null,
    followUp: Array.isArray(step.followUp) ? step.followUp : null,
    extra: step.extra || null,
    order: Number.isFinite(step.order) ? step.order : index,
    updatedAt: serverTimestamp(),
  };
}

function chunkArray(items, size = 400) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function commitOps(ops) {
  if (!ops.length) return;
  const chunks = chunkArray(ops, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === "set") batch.set(op.ref, op.data, { merge: true });
      if (op.type === "delete") batch.delete(op.ref);
    }
    await batch.commit();
  }
}

export function isConfigured() {
  return isFirebaseConfigured;
}

export function subscribeToAuth(callback) {
  const { auth } = ensureFirebase();
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email, password) {
  const { auth } = ensureFirebase();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password) {
  const { auth } = ensureFirebase();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  const { auth } = ensureFirebase();
  return signOut(auth);
}

export async function loadWorkspace(uid) {
  ensureFirebase();

  const settingsSnap = await getDoc(settingsRef(uid));
  const flowsSnap = await getDocs(query(flowsCollection(uid), orderBy("order")));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const groups = Array.isArray(settings.groups) && settings.groups.length
    ? settings.groups
    : DEFAULT_GROUPS;

  const flows = [];
  for (const flowDoc of flowsSnap.docs) {
    const stepsSnap = await getDocs(query(stepsCollection(uid, flowDoc.id), orderBy("order")));
    flows.push({
      ...flowDoc.data(),
      id: flowDoc.id,
      steps: stepsSnap.docs.map((stepDoc) => ({ ...stepDoc.data(), id: stepDoc.id })),
    });
  }

  return {
    theme: settings.theme || "light",
    repName: settings.repName || "",
    groups,
    flows,
  };
}

export async function seedWorkspaceIfEmpty(uid) {
  ensureFirebase();

  const existingFlows = await getDocs(flowsCollection(uid));
  if (!existingFlows.empty) return loadWorkspace(uid);

  const seed = buildSeedWorkspace();
  await saveWorkspace(uid, seed);
  return loadWorkspace(uid);
}


export async function saveUserPreferences(uid, preferences = {}) {
  ensureFirebase();
  const payload = { updatedAt: serverTimestamp() };
  if (Object.prototype.hasOwnProperty.call(preferences, "theme")) payload.theme = preferences.theme || "light";
  if (Object.prototype.hasOwnProperty.call(preferences, "repName")) payload.repName = preferences.repName || "";
  await setDoc(settingsRef(uid), payload, { merge: true });
  return true;
}

export async function saveWorkspace(uid, workspace) {
  ensureFirebase();

  const flowDocs = await getDocs(flowsCollection(uid));
  const existingFlowIds = new Set(flowDocs.docs.map((docSnap) => docSnap.id));
  const nextFlowIds = new Set((workspace.flows || []).map((flow) => flow.id));
  const groups = Array.isArray(workspace.groups) && workspace.groups.length
    ? workspace.groups.map((group, index) => sanitizeGroup(group, index))
    : DEFAULT_GROUPS;
  const fallbackGroupId = groups[0]?.id || "general";

  const ops = [];

  ops.push({
    type: "set",
    ref: settingsRef(uid),
    data: {
      theme: workspace.theme || "light",
      repName: workspace.repName || "",
      groups,
      updatedAt: serverTimestamp(),
    },
  });

  for (const flowDoc of flowDocs.docs) {
    if (!nextFlowIds.has(flowDoc.id)) {
      const stepsSnap = await getDocs(stepsCollection(uid, flowDoc.id));
      for (const stepDoc of stepsSnap.docs) {
        ops.push({ type: "delete", ref: stepDoc.ref });
      }
      ops.push({ type: "delete", ref: flowDoc.ref });
    }
  }

  for (let flowIndex = 0; flowIndex < (workspace.flows || []).length; flowIndex += 1) {
    const flow = workspace.flows[flowIndex];
    const flowRef = doc(db, "users", uid, "flows", flow.id);
    ops.push({
      type: "set",
      ref: flowRef,
      data: sanitizeFlow(flow, flowIndex, fallbackGroupId),
    });

    const existingStepsSnap = existingFlowIds.has(flow.id)
      ? await getDocs(stepsCollection(uid, flow.id))
      : { docs: [] };

    const nextStepIds = new Set((flow.steps || []).map((step) => step.id));
    for (const stepDoc of existingStepsSnap.docs) {
      if (!nextStepIds.has(stepDoc.id)) {
        ops.push({ type: "delete", ref: stepDoc.ref });
      }
    }

    for (let stepIndex = 0; stepIndex < (flow.steps || []).length; stepIndex += 1) {
      const step = flow.steps[stepIndex];
      const stepRef = doc(db, "users", uid, "flows", flow.id, "steps", step.id);
      ops.push({
        type: "set",
        ref: stepRef,
        data: sanitizeStep(step, stepIndex),
      });
    }
  }

  await commitOps(ops);
  return true;
}
