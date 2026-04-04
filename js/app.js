import {
  isConfigured,
  subscribeToAuth,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  saveWorkspace,
  saveUserPreferences,
  seedWorkspaceIfEmpty,
} from "./firebase-service.js";
import { DEFAULT_GROUPS } from "./defaults.js";
import { serializeWorkspaceToText, parseWorkspaceText, validateWorkspaceSchema, mergeWorkspaceByIds } from "./schema-io.js";

const root = document.getElementById("app");

const state = {
  user: null,
  authReady: false,
  authPending: false,
  workspaceLoading: false,
  workspace: null,
  draft: null,
  editMode: false,
  dirty: false,
  saving: false,
  screen: "home",
  activeGroupId: null,
  activeFlowId: null,
  activeStepId: null,
  authMode: "signin",
  authForm: { email: "", password: "" },
  notice: null,
  settingsOpen: false,
  settingsSaving: false,
  settingsDraft: { repName: "", theme: "light" },
  currentCall: blankCurrentCall(),
  quoteModalOpen: false,
  inlineLookup: { loading: false, error: "" },
};

const BRANCH_TONES = {
  flow: "var(--white)",
  money: "#fff7ea",
  decision: "#f4efff",
  danger: "#fff0f0",
  back: "#edf2f7",
  success: "#ebfbf7",
};


const CURRENT_CALL_STORAGE_PREFIX = "call-guide-current-call:";
const QUOTE_CONTEXT_STORAGE_KEY = "joc-quote-context-v1";

const ZILLOW_API_KEY = "13f48093camsh327fb2e22872c41p19ff28jsn9ac49867622f";
const ZILLOW_API_HOST = "private-zillow.p.rapidapi.com";
const ZILLOW_HEADERS = {
  "x-rapidapi-key": ZILLOW_API_KEY,
  "x-rapidapi-host": ZILLOW_API_HOST,
  "Content-Type": "application/json",
};

function blankCurrentCall() {
  return {
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    sqft: "",
    beds: "",
    baths: "",
    serviceType: "",
    dirtLevel: "",
    oneTimePrice: "",
    weeklyPrice: "",
    biweeklyPrice: "",
    monthlyPrice: "",
    addOnSummary: "",
    quoteUpdatedAt: "",
  };
}

function formatUsPhoneInput(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function currentCallStorageKey(uid = state.user?.uid) {
  return uid ? `${CURRENT_CALL_STORAGE_PREFIX}${uid}` : null;
}

function loadCurrentCallContext(uid = state.user?.uid) {
  const key = currentCallStorageKey(uid);
  if (!key) return blankCurrentCall();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return blankCurrentCall();
    const parsed = JSON.parse(raw);
    return { ...blankCurrentCall(), ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch (error) {
    console.error(error);
    return blankCurrentCall();
  }
}

function saveCurrentCallContext() {
  const key = currentCallStorageKey();
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state.currentCall || blankCurrentCall()));
  } catch (error) {
    console.error(error);
  }
}

function clearCurrentCallContext() {
  state.currentCall = blankCurrentCall();
  const key = currentCallStorageKey();
  if (key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(error);
    }
  }
}

function callContextSummary() {
  const data = state.currentCall || blankCurrentCall();
  return [
    data.clientName ? `Client: ${data.clientName}` : null,
    data.clientEmail ? `Email: ${data.clientEmail}` : null,
    data.clientPhone ? `Phone: ${data.clientPhone}` : null,
    data.clientAddress ? `Address: ${data.clientAddress}` : null,
    data.serviceType ? `Service: ${data.serviceType}` : null,
    data.oneTimePrice ? `One-time: ${data.oneTimePrice}` : null,
  ].filter(Boolean).join("\n");
}


function formatMaybeNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return Number.isInteger(num) ? String(num) : String(num);
}

function buildResolvedAddress(raw = {}) {
  return [raw.streetAddress, raw.city, raw.state, raw.zipcode].filter(Boolean).join(", ");
}

function buildPropertyConfirmationLine() {
  const call = state.currentCall || blankCurrentCall();
  const sqft = call.sqft || "—";
  const beds = call.beds || "—";
  const baths = call.baths || "—";
  return `“I’m seeing about ${sqft} square feet, ${beds} bedrooms, and ${baths} bathrooms — does that sound right?”`;
}

function renderInlineText(value = "") {
  return escapeHtml(String(value || "")).replaceAll("\n", "<br>");
}

function matchesScriptPrompt(line = "", patterns = []) {
  const normalized = String(line || "").trim().toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

async function lookupAddressInline() {
  const address = (state.currentCall?.clientAddress || "").trim();
  if (!address) {
    notify("Enter an address first.", "error");
    return;
  }
  state.inlineLookup = { loading: true, error: "" };
  render();
  try {
    const response = await fetch(`https://${ZILLOW_API_HOST}/byaddress?propertyaddress=${encodeURIComponent(address)}`, {
      headers: ZILLOW_HEADERS,
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Lookup failed (${response.status}) ${txt.slice(0, 120)}`);
    }
    const data = await response.json();
    const resolvedAddress = buildResolvedAddress(data.PropertyAddress || {});
    state.currentCall = {
      ...state.currentCall,
      clientAddress: resolvedAddress || state.currentCall.clientAddress || address,
      sqft: data["Area(sqft)"] != null ? formatMaybeNumber(data["Area(sqft)"]) : "",
      beds: data.Bedrooms != null ? formatMaybeNumber(data.Bedrooms) : "",
      baths: data.Bathrooms != null ? formatMaybeNumber(data.Bathrooms) : "",
    };
    saveCurrentCallContext();
    state.inlineLookup = { loading: false, error: "" };
    render();
  } catch (error) {
    console.error(error);
    state.inlineLookup = { loading: false, error: error.message || "Could not look up property." };
    render();
    notify(error.message || "Could not look up property.", "error");
  }
}

function buildQuoteWorkspaceUrl() {
  saveCurrentCallContext();
  const params = new URLSearchParams();
  const data = state.currentCall || blankCurrentCall();
  const repName = (workspaceSource()?.repName || state.workspace?.repName || "").trim();
  if (data.clientName) params.set("client_name", data.clientName);
  if (data.clientEmail) params.set("client_email", data.clientEmail);
  if (data.clientPhone) params.set("client_phone", data.clientPhone);
  if (data.clientAddress) params.set("address", data.clientAddress);
  if (repName) params.set("rep_name", repName);
  return `./quote-workspace.html${params.toString() ? `?${params.toString()}` : ""}`;
}

function openQuoteModal() {
  state.quoteModalOpen = true;
  render();
}

function closeQuoteModal() {
  state.quoteModalOpen = false;
  render();
}

function applyQuoteContext(parsed, { silent = false } = {}) {
  if (!parsed || typeof parsed !== "object") return false;
  const current = state.currentCall || blankCurrentCall();
  state.currentCall = {
    ...current,
    clientName: parsed.clientName || current.clientName || "",
    clientEmail: parsed.clientEmail || current.clientEmail || "",
    clientPhone: parsed.clientPhone || current.clientPhone || "",
    clientAddress: parsed.address || current.clientAddress || "",
    sqft: parsed.sqft || "",
    beds: parsed.beds || "",
    baths: parsed.baths || "",
    serviceType: parsed.serviceType || current.serviceType || "",
    dirtLevel: parsed.dirtLevel || "",
    oneTimePrice: parsed.oneTimePrice || "",
    weeklyPrice: parsed.weeklyPrice || "",
    biweeklyPrice: parsed.biweeklyPrice || "",
    monthlyPrice: parsed.monthlyPrice || "",
    addOnSummary: parsed.addOnSummary || "",
    quoteUpdatedAt: parsed.updatedAt ? new Date(parsed.updatedAt).toLocaleString() : "",
  };
  saveCurrentCallContext();
  if (!silent) notify("Quote data loaded into this call.", "success");
  return true;
}

function pullQuoteContextFromStorage({ silent = false } = {}) {
  try {
    const raw = window.localStorage.getItem(QUOTE_CONTEXT_STORAGE_KEY);
    if (!raw) {
      if (!silent) notify("No quote data found yet.", "error");
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      if (!silent) notify("Quote data is invalid.", "error");
      return;
    }
    const applied = applyQuoteContext(parsed, { silent });
    if (applied) render();
  } catch (error) {
    console.error(error);
    if (!silent) notify("Could not load quote data.", "error");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function personalizeText(value = "") {
  const repName = (state.settingsOpen ? state.settingsDraft.repName : workspaceSource()?.repName) || state.workspace?.repName || "";
  const repFirstName = repName.trim().split(/\s+/).filter(Boolean)[0] || repName.trim();
  const call = state.currentCall || blankCurrentCall();
  const clientName = (call.clientName || "").trim();
  const nameParts = clientName ? clientName.split(/\s+/).filter(Boolean) : [];
  const clientFirstName = nameParts[0] || "";
  const clientLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const replacements = {
    "{{rep_name}}": repName,
    "{{rep_full_name}}": repName,
    "{{rep_first_name}}": repFirstName,
    "{{client_name}}": clientName,
    "{{client_full_name}}": clientName,
    "{{client_first_name}}": clientFirstName,
    "{{client_last_name}}": clientLastName,
    "{{client_email}}": call.clientEmail || "",
    "{{client_phone}}": call.clientPhone || "",
    "{{client_address}}": call.clientAddress || "",
    "{{sqft}}": call.sqft || "",
    "{{beds}}": call.beds || "",
    "{{baths}}": call.baths || "",
    "{{service_type}}": call.serviceType || "",
    "{{dirt_level}}": call.dirtLevel || "",
    "{{one_time_price}}": call.oneTimePrice || "",
    "{{weekly_price}}": call.weeklyPrice || "",
    "{{biweekly_price}}": call.biweeklyPrice || "",
    "{{monthly_price}}": call.monthlyPrice || "",
    "{{add_on_summary}}": call.addOnSummary || "",
  };
  let output = String(value || "");
  for (const [token, replacement] of Object.entries(replacements)) {
    output = output.replaceAll(token, replacement);
  }
  return output;
}

function renderText(value = "") {
  return escapeHtml(personalizeText(value)).replaceAll("\n", "<br>");
}

function applyTheme(theme = "light") {
  document.body.dataset.theme = theme === "dark" ? "dark" : "light";
}

function activeTheme() {
  if (state.settingsOpen && state.settingsDraft.theme) return state.settingsDraft.theme;
  return workspaceSource()?.theme || state.workspace?.theme || "light";
}

function deepClone(value) {
  return structuredClone(value);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `item-${Date.now().toString(36)}`;
}

function uniqueId(base, items) {
  const ids = new Set(items.map((item) => item.id));
  let candidate = slugify(base);
  let index = 2;
  while (ids.has(candidate)) {
    candidate = `${slugify(base)}-${index}`;
    index += 1;
  }
  return candidate;
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function inferSpecialType(step) {
  if (Array.isArray(step?.guarantees) && step.guarantees.length) return "guarantees";
  if (Array.isArray(step?.followUp) && step.followUp.length) return "followup";
  return "standard";
}

function ensureGroups(groups = []) {
  if (Array.isArray(groups) && groups.length) {
    return sortByOrder(groups).map((group, index) => ({
      id: group.id || `group-${index + 1}`,
      name: group.name || `Group ${index + 1}`,
      icon: group.icon || "📞",
      order: index,
    }));
  }
  return DEFAULT_GROUPS.map((group, index) => ({ ...group, order: index }));
}

function normalizeStep(step, index) {
  return {
    id: step.id || `step-${index + 1}`,
    num: step.num || "",
    label: step.label || "Untitled",
    title: step.title || "Untitled Step",
    subtitle: typeof step.subtitle === "string" ? step.subtitle : "",
    script: typeof step.script === "string" ? step.script : "",
    toneCue: typeof step.toneCue === "string" ? step.toneCue : "",
    keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints : [],
    branches: Array.isArray(step.branches) ? step.branches : [],
    main: Boolean(step.main),
    special: Boolean(step.special),
    specialType: step.specialType || inferSpecialType(step),
    parentId: step.parentId || null,
    next: step.next || null,
    guarantees: Array.isArray(step.guarantees) ? step.guarantees : [],
    followUp: Array.isArray(step.followUp) ? step.followUp : [],
    extra: step.extra && typeof step.extra === "object"
      ? { title: step.extra.title || "Notes", items: Array.isArray(step.extra.items) ? step.extra.items : [] }
      : null,
    order: Number.isFinite(step.order) ? step.order : index,
  };
}

function normalizeWorkspace(workspace) {
  const groups = ensureGroups(workspace?.groups || []);
  const fallbackGroupId = groups[0]?.id || "general";
  const flows = sortByOrder(workspace?.flows || []).map((flow, flowIndex) => ({
    id: flow.id || `flow-${flowIndex + 1}`,
    name: flow.name || "Untitled Flow",
    icon: flow.icon || "📞",
    desc: flow.desc || "",
    groupId: groups.some((group) => group.id === flow.groupId) ? flow.groupId : fallbackGroupId,
    order: flowIndex,
    steps: sortByOrder(flow.steps || []).map((step, stepIndex) => normalizeStep(step, stepIndex)),
  }));

  const result = { theme: workspace?.theme || "light", repName: workspace?.repName || "", groups, flows };
  reindexWorkspace(result);
  return result;
}

function workspaceSource() {
  return state.editMode ? state.draft : state.workspace;
}

function groupList() {
  return workspaceSource()?.groups || [];
}

function flowList() {
  return workspaceSource()?.flows || [];
}

function currentFlow() {
  return flowList().find((flow) => flow.id === state.activeFlowId) || flowList()[0] || null;
}

function currentStep() {
  const flow = currentFlow();
  if (!flow) return null;
  return flow.steps.find((step) => step.id === state.activeStepId) || topSteps(flow)[0] || flow.steps[0] || null;
}

function topSteps(flow = currentFlow()) {
  if (!flow) return [];
  return sortByOrder(flow.steps).filter((step) => step.main);
}

function displayStep(step = currentStep()) {
  if (!step) return null;
  if (!step.parentId) return step;
  const flow = currentFlow();
  return flow?.steps.find((candidate) => candidate.id === step.parentId) || step;
}

function stepIndexInfo(step = currentStep(), flow = currentFlow()) {
  if (!step || !flow) return { position: 0, total: 0 };
  const steps = topSteps(flow);
  const baseId = step.parentId || step.id;
  const index = steps.findIndex((item) => item.id === baseId);
  return { position: index >= 0 ? index + 1 : 0, total: steps.length };
}

function syncSelection() {
  const groups = groupList();
  const flows = flowList();
  if (!groups.length) state.activeGroupId = null;
  else if (!groups.some((group) => group.id === state.activeGroupId)) state.activeGroupId = groups[0].id;

  if (!flows.length) {
    state.activeFlowId = null;
    state.activeStepId = null;
    state.screen = "home";
    return;
  }

  const flow = flows.find((item) => item.id === state.activeFlowId) || flows[0];
  state.activeFlowId = flow.id;

  const steps = flow.steps || [];
  if (!steps.length) {
    state.activeStepId = null;
    return;
  }
  const preferred = steps.find((item) => item.id === state.activeStepId) || topSteps(flow)[0] || steps[0];
  state.activeStepId = preferred.id;
}

function notify(message, tone = "info") {
  state.notice = { message, tone };
  render();
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    state.notice = null;
    render();
  }, 2600);
}

function reindexFlow(flow) {
  flow.steps = sortByOrder(flow.steps || []).map((step, index) => ({ ...step, order: index }));
  let counter = 1;
  flow.steps = flow.steps.map((step) => {
    if (step.main) {
      return { ...step, num: String(counter++).padStart(2, "0") };
    }
    return { ...step, num: step.num || "" };
  });
}

function reindexWorkspace(workspace) {
  workspace.groups = sortByOrder(workspace.groups || []).map((group, index) => ({ ...group, order: index }));
  workspace.flows = sortByOrder(workspace.flows || []).map((flow, index) => {
    const next = { ...flow, order: index, steps: sortByOrder(flow.steps || []) };
    reindexFlow(next);
    return next;
  });
}

function updateDraft(mutator, shouldRender = true) {
  if (!state.editMode || !state.draft) return;
  mutator(state.draft);
  reindexWorkspace(state.draft);
  syncSelection();
  state.dirty = true;
  if (shouldRender) render();
}

function flowById(workspace, flowId) {
  return workspace?.flows?.find((flow) => flow.id === flowId) || null;
}

function stepById(flow, stepId) {
  return flow?.steps?.find((step) => step.id === stepId) || null;
}

function selectFlow(flowId) {
  state.activeFlowId = flowId;
  state.screen = "flow";
  const flow = currentFlow();
  state.activeStepId = topSteps(flow)[0]?.id || flow?.steps?.[0]?.id || null;
  render();
}

async function toggleEditMode() {
  if (!state.user) return;
  if (!state.editMode) {
    state.draft = deepClone(state.workspace);
    state.editMode = true;
    state.dirty = false;
    render();
    return;
  }

  if (state.saving || !state.draft) return;
  try {
    state.saving = true;
    render();
    reindexWorkspace(state.draft);
    await saveWorkspace(state.user.uid, state.draft);
    state.workspace = normalizeWorkspace(state.draft);
    state.draft = null;
    state.editMode = false;
    state.dirty = false;
    syncSelection();
    notify("Changes saved.", "success");
  } catch (error) {
    console.error(error);
    notify(error.message || "Could not save changes.", "error");
  } finally {
    state.saving = false;
    render();
  }
}

function currentBuilderStep() {
  const flow = flowById(state.draft, state.activeFlowId);
  return stepById(flow, state.activeStepId);
}

function createMainStep() {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    if (!flow) return;
    const step = {
      id: uniqueId(`step-${uid()}`, flow.steps),
      label: "New Step",
      title: "New Step",
      subtitle: "",
      script: "",
      toneCue: "",
      keyPoints: [],
      branches: [],
      main: true,
      special: false,
      specialType: "standard",
      parentId: null,
      next: null,
      guarantees: [],
      followUp: [],
      extra: null,
      order: flow.steps.length,
    };
    flow.steps.push(step);
    state.activeStepId = step.id;
  });
}

function createBranchStep() {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    if (!flow) return;
    const active = stepById(flow, state.activeStepId);
    if (!active) return;
    const parent = active.parentId ? stepById(flow, active.parentId) : active;
    if (!parent) return;
    const step = {
      id: uniqueId(`branch-${uid()}`, flow.steps),
      label: "New Branch",
      title: "New Branch",
      subtitle: "",
      script: "",
      toneCue: "",
      keyPoints: [],
      branches: [],
      main: false,
      special: false,
      specialType: "standard",
      parentId: parent.id,
      next: null,
      guarantees: [],
      followUp: [],
      extra: null,
      order: flow.steps.length,
    };
    flow.steps.push(step);
    parent.branches = [...(parent.branches || []), { label: "New Branch", color: "decision", targetId: step.id }];
    state.activeStepId = step.id;
  });
}

function createSpecialStep(type) {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    if (!flow) return;
    const step = {
      id: uniqueId(`${type}-${uid()}`, flow.steps),
      label: type === "guarantees" ? "Guarantees" : "Follow-Up",
      title: type === "guarantees" ? "Guarantees" : "Follow-Up",
      subtitle: "",
      script: "",
      toneCue: "",
      keyPoints: [],
      branches: [],
      main: true,
      special: true,
      specialType: type,
      parentId: null,
      next: null,
      guarantees: type === "guarantees" ? [{ name: "Guarantee", script: "" }] : [],
      followUp: type === "followup" ? [{ day: "Day 1", content: "" }] : [],
      extra: null,
      order: flow.steps.length,
    };
    flow.steps.push(step);
    state.activeStepId = step.id;
  });
}

function duplicateCurrentStep() {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const source = stepById(flow, state.activeStepId);
    if (!flow || !source) return;
    const clone = deepClone(source);
    clone.id = uniqueId(`${source.label || source.title}-copy`, flow.steps);
    clone.label = `${source.label || source.title} Copy`;
    clone.title = `${source.title || source.label} Copy`;
    clone.order = (source.order ?? flow.steps.length) + 0.5;
    clone.branches = Array.isArray(clone.branches) ? clone.branches.map((branch) => ({ ...branch })) : [];
    flow.steps.push(clone);
    state.activeStepId = clone.id;
  });
}

function deleteCurrentStep() {
  if (!state.editMode) return;
  const source = currentBuilderStep();
  if (!source) return;
  const message = `Delete ${source.title || source.label}?`;
  if (!window.confirm(message)) return;

  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    if (!flow) return;
    const targetIds = new Set([source.id]);
    if (source.main) {
      flow.steps.filter((step) => step.parentId === source.id).forEach((step) => targetIds.add(step.id));
    }
    flow.steps = flow.steps.filter((step) => !targetIds.has(step.id));
    flow.steps = flow.steps.map((step) => ({
      ...step,
      next: targetIds.has(step.next) ? null : step.next,
      branches: (step.branches || []).filter((branch) => !targetIds.has(branch.targetId)),
    }));
    state.activeStepId = topSteps(flow)[0]?.id || flow.steps[0]?.id || null;
  });
}

function moveCurrentStep(direction) {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const step = stepById(flow, state.activeStepId);
    if (!flow || !step) return;
    const list = step.main ? topSteps(flow) : flow.steps.filter((item) => !item.main && item.parentId === step.parentId);
    const index = list.findIndex((item) => item.id === step.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= list.length) return;
    const current = list[index];
    const other = list[swapWith];
    const currentOrder = current.order;
    current.order = other.order;
    other.order = currentOrder;
  });
}

function addItem(listName) {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const step = stepById(flow, state.activeStepId);
    if (!step) return;
    if (listName === "keyPoints") step.keyPoints = [...step.keyPoints, ""];
    if (listName === "extraItems") {
      if (!step.extra) step.extra = { title: "Notes", items: [] };
      step.extra.items = [...step.extra.items, ""];
    }
    if (listName === "guarantees") step.guarantees = [...step.guarantees, { name: "Guarantee", script: "" }];
    if (listName === "followUp") step.followUp = [...step.followUp, { day: "Day", content: "" }];
  });
}

function removeListItem(listName, index) {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const step = stepById(flow, state.activeStepId);
    if (!step) return;
    if (listName === "keyPoints") step.keyPoints = step.keyPoints.filter((_, itemIndex) => itemIndex !== index);
    if (listName === "extraItems" && step.extra) step.extra.items = step.extra.items.filter((_, itemIndex) => itemIndex !== index);
    if (listName === "guarantees") step.guarantees = step.guarantees.filter((_, itemIndex) => itemIndex !== index);
    if (listName === "followUp") step.followUp = step.followUp.filter((_, itemIndex) => itemIndex !== index);
  });
}

function addBranchRow() {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const step = stepById(flow, state.activeStepId);
    if (!step) return;
    step.branches = [...(step.branches || []), { label: "New Branch", color: "decision", targetId: null }];
  });
}

function removeBranch(index) {
  updateDraft((draft) => {
    const flow = flowById(draft, state.activeFlowId);
    const step = stepById(flow, state.activeStepId);
    if (!step) return;
    step.branches = (step.branches || []).filter((_, branchIndex) => branchIndex !== index);
  });
}

function addGroup() {
  updateDraft((draft) => {
    const group = {
      id: uniqueId(`group-${uid()}`, draft.groups),
      name: "New Group",
      icon: "📞",
      order: draft.groups.length,
    };
    draft.groups.push(group);
    state.activeGroupId = group.id;
  });
}

function deleteGroup(groupId) {
  updateDraft((draft) => {
    if (draft.groups.length <= 1) {
      notify("Keep at least one group.", "error");
      return;
    }
    const fallbackId = draft.groups.find((group) => group.id !== groupId)?.id;
    draft.groups = draft.groups.filter((group) => group.id !== groupId);
    draft.flows = draft.flows.map((flow) => ({
      ...flow,
      groupId: flow.groupId === groupId ? fallbackId : flow.groupId,
    }));
    state.activeGroupId = fallbackId;
  });
}

function addFlow() {
  updateDraft((draft) => {
    const flows = draft.flows || [];
    const flow = {
      id: uniqueId(`flow-${uid()}`, flows),
      name: "New Call Type",
      icon: "📞",
      desc: "",
      groupId: state.activeGroupId || draft.groups[0]?.id || "general",
      order: flows.length,
      steps: [],
    };
    draft.flows.push(flow);
    state.activeFlowId = flow.id;
    state.screen = "flow";
    createMainStep();
  }, false);
  render();
}

function deleteFlow(flowId) {
  if (!window.confirm("Delete this call type?")) return;
  updateDraft((draft) => {
    draft.flows = draft.flows.filter((flow) => flow.id !== flowId);
    state.activeFlowId = draft.flows[0]?.id || null;
    state.activeStepId = draft.flows[0]?.steps?.[0]?.id || null;
    state.screen = "home";
  });
}

function openImport() {
  const input = document.getElementById("workspace-import");
  input?.click();
}

function promptImportMode() {
  const answer = window.prompt(
    [
      'Import mode?',
      'Type MERGE to update matching call type ids and add new ones.',
      'Type REPLACE to swap the whole workspace.',
      'Leave blank to cancel.'
    ].join('\n'),
    'merge'
  );
  if (!answer) return null;
  const value = answer.trim().toLowerCase();
  if (value === 'merge' || value === 'replace') return value;
  notify('Import cancelled. Type merge or replace.', 'error');
  return null;
}

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseWorkspaceText(String(reader.result || ""));
      const imported = normalizeWorkspace(parsed);
      const issues = validateWorkspaceSchema(imported);
      if (issues.length) {
        throw new Error(issues.slice(0, 6).join('\n'));
      }

      const mode = promptImportMode();
      if (!mode) return;

      const baseWorkspace = state.editMode && state.draft ? state.draft : state.workspace;
      const nextWorkspace = mode === 'merge'
        ? normalizeWorkspace(mergeWorkspaceByIds(baseWorkspace, imported))
        : imported;

      state.draft = deepClone(nextWorkspace);
      state.editMode = true;
      state.dirty = true;
      state.screen = 'home';
      syncSelection();
      render();
      notify(
        mode === 'merge'
          ? 'Merged into draft. Review it, then hit ✓ to save.'
          : 'Replacement loaded into draft. Hit ✓ to save it.',
        'success'
      );
    } catch (error) {
      console.error(error);
      notify(error.message || 'Could not import that file.', 'error');
    }
  };
  reader.readAsText(file);
}

function exportWorkspace() {
  const payload = serializeWorkspaceToText(workspaceSource());
  const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'call-guide-workspace.txt';
  anchor.click();
  URL.revokeObjectURL(url);
}

function beforeUnload(event) {
  if (!state.editMode || !state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
}

function renderNotice() {
  if (!state.notice) return "";
  return `<div class="notice ${escapeHtml(state.notice.tone)}">${escapeHtml(state.notice.message)}</div>`;
}

function authScreen() {
  const mode = state.authMode === "signin" ? "Sign in" : "Create account";
  const altMode = state.authMode === "signin" ? "Create account" : "Sign in";
  const status = !isConfigured()
    ? `<div class="notice error">Firebase is not configured yet.</div>`
    : state.notice
      ? renderNotice()
      : "";

  return `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>${mode}</h1>
        <p>Use email and password.</p>
        <form class="auth-form" data-form="auth">
          <label>
            <span>Email</span>
            <input type="email" name="email" autocomplete="email" value="${escapeHtml(state.authForm.email)}" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" autocomplete="current-password" value="${escapeHtml(state.authForm.password)}" required />
          </label>
          <button type="submit" class="primary-btn">${state.authPending ? "Working…" : mode}</button>
        </form>
        <div class="inline-actions" style="margin-top:12px;">
          <button class="ghost-btn" type="button" data-action="switch-auth-mode">${altMode}</button>
        </div>
        ${status}
      </div>
    </div>
  `;
}

function loadingScreen() {
  return `
    <div class="loading-wrap">
      <div class="loading-card">Loading…</div>
    </div>
  `;
}

function homeScreen() {
  const groups = groupList();
  const activeGroup = groups.find((group) => group.id === state.activeGroupId) || groups[0];
  const flows = flowList().filter((flow) => flow.groupId === activeGroup?.id);
  const repLabel = (state.workspace?.repName || "").trim();

  return `
    <div class="shell">
      <div class="utility-row">
        <div>
          <h1 class="home-title">Select call type</h1>
          <div class="home-intro">${repLabel ? `Signed in as ${escapeHtml(repLabel)}. ` : ""}Pick the call, then follow the steps across the top.</div>
        </div>
        <div></div>
        <div class="utility-actions">
          <button class="small-btn" data-action="export-workspace">Export .txt</button>
          <button class="small-btn" data-action="import-workspace">Import .txt</button>
          <input id="workspace-import" type="file" accept=".txt,.yaml,.yml,application/json,text/plain" class="hidden" />
          <button class="small-btn" data-action="toggle-settings">Settings</button>
        </div>
      </div>


      <div class="home-grid">
        <div class="home-card">
          <div class="group-tabs">
            ${groups.map((group) => `
              <button class="pill-btn ${group.id === activeGroup?.id ? "active" : ""}" data-action="select-group" data-group-id="${escapeHtml(group.id)}">
                ${escapeHtml(group.name)}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="home-flows">
          ${flows.map((flow) => `
            <button class="select-card" data-action="open-flow" data-flow-id="${escapeHtml(flow.id)}">
              <strong>${escapeHtml(flow.name)}</strong>
              <span>${escapeHtml(flow.desc || "")}</span>
            </button>
          `).join("") || `<div class="empty-state">No call types in this group yet.</div>`}
        </div>

        ${renderSettingsPanel()}
        ${state.editMode ? renderHomeBuilder() : ""}
        ${renderNotice()}
      </div>

      ${renderFab()}
      ${renderQuoteModal()}
    </div>
  `;
}



function stepTextFingerprint(step) {
  return `${step?.title || ""} ${step?.label || ""} ${step?.subtitle || ""}`.toLowerCase();
}

function getContextSections(step) {
  const fp = stepTextFingerprint(step);
  const num = String(step?.num || step?.stepNumber || "").replace(/[^0-9]/g, "");
  const showContact = num === "02" || /contact|info|quote|confirm/.test(fp);
  const showProperty = ["03", "04", "05"].includes(num) || /intent|property|detail|path|type|service|scope|checklist|address/.test(fp);
  const showQuote = ["07", "08", "09", "10", "11"].includes(num) || /value|price|invest|close|schedule|deposit/.test(fp);
  return { showContact, showProperty, showQuote };
}

function renderStepContextAssist(step) {
  return "";
}

function renderQuoteModal() {
  if (!state.quoteModalOpen) return "";
  return `
    <div class="modal-backdrop" data-action="close-quote-modal">
      <div class="quote-modal-shell" role="dialog" aria-modal="true" aria-label="Quote tool" onclick="event.stopPropagation()">
        <div class="quote-modal-toolbar">
          <div>
            <div class="context-title">Quote tool</div>
            <div class="helper-text">Use the calculator here. When you are done, click Apply to Script inside the calculator or use the button here.</div>
          </div>
          <div class="inline-actions quote-modal-actions">
            <button type="button" id="quoteModalApplyBtn" class="ghost-btn">Apply latest quote</button>
            <button type="button" id="quoteModalCloseBtn" class="small-btn">Close</button>
          </div>
        </div>
        <div class="quote-modal">
          <iframe class="quote-frame" src="${escapeHtml(buildQuoteWorkspaceUrl())}" title="Quote workspace"></iframe>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsPanel() {
  if (!state.settingsOpen) return "";
  return `
    <div class="builder-card settings-card">
      <div class="builder-title">Settings</div>
      <div class="builder-grid two" style="margin-top:12px;">
        <label>
          <span>Sales rep name</span>
          <input value="${escapeHtml(state.settingsDraft.repName || "")}" data-role="settings-field" data-field="repName" placeholder="Andre" />
        </label>
        <label>
          <span>Appearance</span>
          <select data-role="settings-field" data-field="theme">
            <option value="light" ${state.settingsDraft.theme === "light" ? "selected" : ""}>Light</option>
            <option value="dark" ${state.settingsDraft.theme === "dark" ? "selected" : ""}>Dark</option>
          </select>
        </label>
      </div>
      <div class="inline-actions" style="margin-top:12px;">
        <button class="small-btn" data-action="save-settings" ${state.settingsSaving ? "disabled" : ""}>${state.settingsSaving ? "Saving…" : "Save settings"}</button>
        <button class="ghost-btn" data-action="toggle-settings">Close</button>
        <button class="warning-btn" data-action="sign-out">Sign out</button>
      </div>
      <div class="helper-text" style="margin-top:10px;">These settings are saved per logged-in user. Scripts can use {{rep_name}}, {{rep_first_name}}, {{client_first_name}}, {{client_name}}, {{client_email}}, {{client_phone}}, {{client_address}}, {{sqft}}, {{beds}}, {{baths}}, {{service_type}}, {{one_time_price}}, {{weekly_price}}, {{biweekly_price}}, and {{monthly_price}}.</div>
    </div>
  `;
}

function renderHomeBuilder() {
  const draft = state.draft;
  if (!draft) return "";
  return `
    <div class="builder-layout">
      <div class="builder-card">
        <div class="builder-title">Groups</div>
        <div class="stack-list" style="margin-top:12px;">
          ${draft.groups.map((group) => `
            <div class="group-manager-row">
              <input value="${escapeHtml(group.icon || "")}" data-role="group-field" data-group-id="${escapeHtml(group.id)}" data-field="icon" />
              <input value="${escapeHtml(group.name || "")}" data-role="group-field" data-group-id="${escapeHtml(group.id)}" data-field="name" />
              <button class="small-btn" data-action="move-group" data-group-id="${escapeHtml(group.id)}" data-direction="up">↑</button>
              <button class="small-btn" data-action="move-group" data-group-id="${escapeHtml(group.id)}" data-direction="down">↓</button>
              <button class="warning-btn" data-action="delete-group" data-group-id="${escapeHtml(group.id)}">Delete</button>
            </div>
          `).join("")}
        </div>
        <div class="inline-actions" style="margin-top:12px;">
          <button class="small-btn" data-action="add-group">Add group</button>
        </div>
      </div>

      <div class="builder-card">
        <div class="builder-title">Call types</div>
        <div class="stack-list" style="margin-top:12px;">
          ${draft.flows.map((flow) => `
            <div class="flow-manager-row">
              <input value="${escapeHtml(flow.icon || "")}" data-role="flow-field" data-flow-id="${escapeHtml(flow.id)}" data-field="icon" />
              <input value="${escapeHtml(flow.name || "")}" data-role="flow-field" data-flow-id="${escapeHtml(flow.id)}" data-field="name" />
              <select data-role="flow-field" data-flow-id="${escapeHtml(flow.id)}" data-field="groupId">
                ${draft.groups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === flow.groupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}
              </select>
              <div class="inline-actions">
                <button class="small-btn" data-action="open-flow" data-flow-id="${escapeHtml(flow.id)}">Open</button>
                <button class="warning-btn" data-action="delete-flow" data-flow-id="${escapeHtml(flow.id)}">Delete</button>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="builder-grid two" style="margin-top:12px;">
          <label>
            <span>Add call type</span>
            <button class="small-btn" data-action="add-flow" type="button">Create</button>
          </label>
          <label>
            <span>Import or export</span>
            <div class="inline-actions">
              <button class="small-btn" data-action="export-workspace">Export .txt</button>
              <button class="small-btn" data-action="import-workspace">Import .txt</button>
            </div>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderEditableStepText(step) {
  if (!state.editMode) return `<div class="ribbon-text">${renderText(step.subtitle)}</div>`;
  return `<textarea data-role="step-field" data-field="subtitle">${escapeHtml(step.subtitle || "")}</textarea>`;
}

function renderInlineField(field, options = {}) {
  const call = state.currentCall || blankCurrentCall();
  const value = call[field] || "";
  const type = options.type || "text";
  const placeholder = options.placeholder || "";
  const extraAttrs = [];
  if (type === "tel") extraAttrs.push('inputmode="tel" autocomplete="tel" maxlength="14"');
  if (type === "email") extraAttrs.push('inputmode="email" autocomplete="email"');
  return `
    <div class="inline-answer-block">
      <input type="${type}" ${extraAttrs.join(" ")} value="${escapeHtml(value)}" data-role="current-call-field" data-field="${escapeHtml(field)}" placeholder="${escapeHtml(placeholder)}" />
    </div>
  `;
}

function renderAddressLookupBlock() {
  const call = state.currentCall || blankCurrentCall();
  return `
    <div class="inline-answer-block inline-address-block">
      <input value="${escapeHtml(call.clientAddress || "")}" data-role="current-call-field" data-field="clientAddress" placeholder="833 Marco Dr NE, St Petersburg, FL 33702" />
      <div class="inline-row-actions">
        <button class="small-btn" data-action="lookup-zillow-inline">Lookup Zillow</button>
        <button class="ghost-btn" data-action="open-quote-modal">Quote tool</button>
      </div>
      ${state.inlineLookup.loading ? `<div class="inline-feedback">Looking up property…</div>` : ""}
      ${state.inlineLookup.error ? `<div class="inline-feedback error">${escapeHtml(state.inlineLookup.error)}</div>` : ""}
    </div>
  `;
}

function renderScriptLineWithFields(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed) return `<div class="script-gap"></div>`;
  const isPropertyConfirmation = matchesScriptPrompt(trimmed, ["i’m seeing about [x] square feet", "i'm seeing about [x] square feet"]);
  const displayLine = isPropertyConfirmation && (state.currentCall?.sqft || state.currentCall?.beds || state.currentCall?.baths)
    ? buildPropertyConfirmationLine()
    : personalizeText(trimmed);

  let attachment = "";
  if (matchesScriptPrompt(trimmed, ["first and last name"])) {
    attachment = renderInlineField("clientName", { placeholder: "Jane Smith" });
  } else if (matchesScriptPrompt(trimmed, ["best email to send", "best email"])) {
    attachment = renderInlineField("clientEmail", { type: "email", placeholder: "jane@email.com" });
  } else if (matchesScriptPrompt(trimmed, ["best number to reach", "best phone number", "best number"])) {
    attachment = renderInlineField("clientPhone", { type: "tel", placeholder: "(727) 555-0199" });
  } else if (matchesScriptPrompt(trimmed, ["property address"])) {
    attachment = renderAddressLookupBlock();
  } else if (matchesScriptPrompt(trimmed, ["scale from 1 to 10", "how would you rate the home"])) {
    attachment = renderInlineField("dirtLevel", { placeholder: "1-10" });
  }

  return `
    <div class="script-line-block">
      <div class="script-line">${renderInlineText(displayLine)}</div>
      ${attachment}
    </div>
  `;
}

function renderScript(step) {
  if (step.special && step.specialType === "guarantees") {
    return `
      <div class="page-section">
        ${step.guarantees.map((item, index) => `
          <div class="timeline-card">
            ${state.editMode ? `
              <div class="timeline-row">
                <input value="${escapeHtml(item.name || "")}" data-role="guarantee-field" data-index="${index}" data-field="name" />
                <textarea data-role="guarantee-field" data-index="${index}" data-field="script">${escapeHtml(item.script || "")}</textarea>
                <button class="warning-btn" data-action="remove-guarantee" data-index="${index}">×</button>
              </div>
            ` : `
              <div class="guarantee-name">${escapeHtml(item.name || "")}</div>
              <div>${renderText(item.script || "")}</div>
            `}
          </div>
        `).join("")}
        ${state.editMode ? `<div class="inline-actions"><button class="small-btn" data-action="add-guarantee">Add guarantee</button></div>` : ""}
      </div>
    `;
  }

  if (step.special && step.specialType === "followup") {
    return `
      <div class="page-section">
        ${step.followUp.map((item, index) => `
          <div class="timeline-card">
            ${state.editMode ? `
              <div class="timeline-row">
                <input value="${escapeHtml(item.day || "")}" data-role="followup-field" data-index="${index}" data-field="day" />
                <textarea data-role="followup-field" data-index="${index}" data-field="content">${escapeHtml(item.content || "")}</textarea>
                <button class="warning-btn" data-action="remove-followup" data-index="${index}">×</button>
              </div>
            ` : `
              <div class="timeline-day">${escapeHtml(item.day || "")}</div>
              <div>${renderText(item.content || "")}</div>
            `}
          </div>
        `).join("")}
        ${state.editMode ? `<div class="inline-actions"><button class="small-btn" data-action="add-followup">Add follow-up entry</button></div>` : ""}
      </div>
    `;
  }

  return `
    <div class="script-card">
      <span class="script-label">Script</span>
      ${state.editMode
        ? `<textarea data-role="step-field" data-field="script">${escapeHtml(step.script || "")}</textarea>`
        : `<div class="script-text script-lines">${String(step.script || "").split("
").map((line) => renderScriptLineWithFields(line)).join("")}</div>`}
    </div>
  `;
}

function renderActionRow(step, flow) {
  const branches = step.branches || [];
  const buttons = branches.map((branch, index) => {
    const target = flow.steps.find((item) => item.id === branch.targetId);
    if (!branch.targetId || !target) return "";
    return `
      <button class="branch-btn" data-action="go-step" data-step-id="${escapeHtml(branch.targetId)}" style="background:${BRANCH_TONES[branch.color] || "var(--white)"};">
        ${escapeHtml(branch.label || "Branch")}
      </button>
    `;
  }).filter(Boolean);

  if (step.next) {
    const next = flow.steps.find((item) => item.id === step.next);
    if (next) {
      buttons.push(`<button class="primary-btn" data-action="go-step" data-step-id="${escapeHtml(next.id)}">Next</button>`);
    }
  }

  if (!buttons.length) return "";
  return `<div class="action-row">${buttons.join("")}</div>`;
}

function renderKeyPoints(step) {
  if (!step.keyPoints?.length && !state.editMode) return "";
  return `
    <div class="page-section">
      <span class="section-label">Key points</span>
      ${state.editMode ? `
        <div class="inline-list compact">
          ${(step.keyPoints || []).map((item, index) => `
            <div class="item-row">
              <input value="${escapeHtml(item || "")}" data-role="keypoint-field" data-index="${index}" />
              <button class="warning-btn" data-action="remove-keypoint" data-index="${index}">×</button>
            </div>
          `).join("")}
          <div class="inline-actions"><button class="small-btn" data-action="add-keypoint">Add key point</button></div>
        </div>
      ` : `
        <ul class="keypoints-list">${step.keyPoints.map((item) => `<li>${escapeHtml(personalizeText(item))}</li>`).join("")}</ul>
      `}
    </div>
  `;
}

function renderTone(step) {
  if (!step.toneCue && !state.editMode) return "";
  return `
    <div class="tone-box">
      ${state.editMode
        ? `<textarea data-role="step-field" data-field="toneCue">${escapeHtml(step.toneCue || "")}</textarea>`
        : renderText(step.toneCue || "")}
    </div>
  `;
}

function renderExtra(step) {
  if (!step.extra && !state.editMode) return "";
  const extra = step.extra || { title: "Notes", items: [] };
  return `
    <div class="extra-box">
      ${state.editMode ? `
        <div class="page-section">
          <label>
            <span>Extra title</span>
            <input value="${escapeHtml(extra.title || "")}" data-role="extra-title" />
          </label>
          <div class="inline-list compact">
            ${(extra.items || []).map((item, index) => `
              <div class="item-row">
                <input value="${escapeHtml(item || "")}" data-role="extra-item" data-index="${index}" />
                <button class="warning-btn" data-action="remove-extra-item" data-index="${index}">×</button>
              </div>
            `).join("")}
            <div class="inline-actions"><button class="small-btn" data-action="add-extra-item">Add line</button></div>
          </div>
        </div>
      ` : `
        <span class="section-label">${escapeHtml(personalizeText(extra.title || "Notes"))}</span>
        <ul class="extra-list">${(extra.items || []).map((item) => `<li>${escapeHtml(personalizeText(item))}</li>`).join("")}</ul>
      `}
    </div>
  `;
}

function renderStepBuilder(step, flow) {
  if (!state.editMode) return "";
  const parent = step.parentId ? flow.steps.find((item) => item.id === step.parentId) : null;
  return `
    <div class="builder-layout">
      <div class="edit-strip">
        <div class="inline-actions">
          <button class="small-btn" data-action="add-step">Add step</button>
          <button class="small-btn" data-action="add-branch-step">Add branch</button>
          <button class="small-btn" data-action="add-special-step" data-type="guarantees">Add guarantees</button>
          <button class="small-btn" data-action="add-special-step" data-type="followup">Add follow-up</button>
          <button class="small-btn" data-action="duplicate-step">Duplicate</button>
          <button class="small-btn" data-action="move-step" data-direction="up">Move left</button>
          <button class="small-btn" data-action="move-step" data-direction="down">Move right</button>
          <button class="warning-btn" data-action="delete-step">Delete</button>
        </div>
      </div>

      <div class="builder-card">
        <div class="builder-grid two">
          <label>
            <span>Label</span>
            <input value="${escapeHtml(step.label || "")}" data-role="step-field" data-field="label" />
          </label>
          <label>
            <span>Title</span>
            <input value="${escapeHtml(step.title || "")}" data-role="step-field" data-field="title" />
          </label>
          <label>
            <span>Stage button text</span>
            <input value="${escapeHtml(step.parentId ? parent?.label || "Branch" : step.label || "")}" data-role="stage-label" />
          </label>
          <label>
            <span>Next step</span>
            <select data-role="step-field" data-field="next">
              <option value="">None</option>
              ${flow.steps.filter((item) => item.id !== step.id).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === step.next ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Main step</span>
            <select data-role="step-field" data-field="main">
              <option value="true" ${step.main ? "selected" : ""}>Yes</option>
              <option value="false" ${!step.main ? "selected" : ""}>No</option>
            </select>
          </label>
          <label>
            <span>Special type</span>
            <select data-role="step-field" data-field="specialType">
              <option value="standard" ${step.specialType === "standard" ? "selected" : ""}>Standard</option>
              <option value="guarantees" ${step.specialType === "guarantees" ? "selected" : ""}>Guarantees</option>
              <option value="followup" ${step.specialType === "followup" ? "selected" : ""}>Follow-up</option>
            </select>
          </label>
        </div>
      </div>

      ${!step.special ? `
        <div class="builder-card">
          <div class="builder-title">Branches</div>
          <div class="stack-list" style="margin-top:12px;">
            ${(step.branches || []).map((branch, index) => `
              <div class="branch-row">
                <input value="${escapeHtml(branch.label || "")}" data-role="branch-field" data-index="${index}" data-field="label" />
                <select data-role="branch-field" data-index="${index}" data-field="color">
                  ${["flow", "money", "decision", "danger", "back", "success"].map((tone) => `<option value="${tone}" ${tone === branch.color ? "selected" : ""}>${tone}</option>`).join("")}
                </select>
                <select data-role="branch-field" data-index="${index}" data-field="targetId">
                  <option value="">No target</option>
                  ${flow.steps.filter((item) => item.id !== step.id).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === branch.targetId ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
                </select>
                <button class="warning-btn" data-action="remove-branch" data-index="${index}">×</button>
              </div>
            `).join("")}
          </div>
          <div class="inline-actions" style="margin-top:12px;"><button class="small-btn" data-action="add-branch-row">Add branch button</button></div>
        </div>
      ` : ""}
    </div>
  `;
}

function flowScreen() {
  const flow = currentFlow();
  const step = currentStep();

  if (!flow) {
    return `
      <div class="shell">
        <div class="empty-state">No call types yet.</div>
        ${renderFab()}
      </div>
    `;
  }

  if (!step) {
    return `
      <div class="shell">
        <div class="flow-topbar">
          <button class="home-btn" data-action="go-home">⌂</button>
          <div class="topbar-label">${escapeHtml(flow.name)}</div>
        </div>
        <div class="empty-state">This call type has no steps yet.</div>
        ${renderFab()}
      </div>
    `;
  }

  const display = displayStep(step);
  const info = stepIndexInfo(step, flow);
  const top = topSteps(flow);
  const parent = step.parentId ? flow.steps.find((item) => item.id === step.parentId) : null;

  return `
    <div class="shell">
      <div class="flow-topbar">
        <button class="home-btn" data-action="go-home" aria-label="Home">⌂</button>
        <div class="step-tabs">
          ${top.map((item) => `
            <button class="step-tab ${(item.id === (step.parentId || step.id)) ? "active" : ""}" data-action="go-step" data-step-id="${escapeHtml(item.id)}">
              ${escapeHtml(item.num || "")}&nbsp;${escapeHtml(item.label || item.title)}
            </button>
          `).join("")}
        </div>
      </div>


      <div class="flow-layout">
        <aside class="step-rail">
          <div class="step-rail-top">
            <div class="step-num">${escapeHtml(step.num || parent?.num || "•")}</div>
            <div class="step-title">${state.editMode
              ? `<input value="${escapeHtml(step.title || "")}" data-role="step-field" data-field="title" />`
              : escapeHtml(step.title || "")}</div>
            <div class="step-side-subtitle">${state.editMode
              ? `<input value="${escapeHtml(step.label || "")}" data-role="step-field" data-field="label" />`
              : escapeHtml(step.label || "")}</div>
            <div class="stage-pill">${escapeHtml(step.parentId ? parent?.label || "Branch" : (step.label || step.title || "Step"))}</div>
          </div>
          <div class="rail-footer">${info.position} of ${info.total}</div>
        </aside>

        <main class="content-panel">
          <div class="flow-heading">${escapeHtml(flow.name)}</div>
          ${parent ? `<div class="parent-row"><div>Branch from ${escapeHtml(parent.title)}</div><button class="small-btn" data-action="go-step" data-step-id="${escapeHtml(parent.id)}">Back to parent</button></div>` : ""}
          <div class="ribbon">${renderEditableStepText(step)}</div>
          ${renderStepContextAssist(step)}
          ${renderScript(step)}
          ${!step.special ? renderActionRow(step, flow) : ""}
          ${renderKeyPoints(step)}
          ${renderTone(step)}
          ${renderExtra(step)}
          ${renderStepBuilder(step, flow)}
          ${renderNotice()}
        </main>
      </div>

      ${renderFab()}
      ${renderQuoteModal()}
    </div>
  `;
}

function renderFab() {
  if (!state.user || state.workspaceLoading) return "";
  return `<button class="fab" data-action="toggle-edit" aria-label="${state.editMode ? "Save" : "Edit"}">${state.saving ? "…" : state.editMode ? "✓" : "✎"}</button>`;
}

function render() {
  applyTheme(activeTheme());
  if (!state.authReady) {
    root.innerHTML = loadingScreen();
    return;
  }
  if (!state.user) {
    root.innerHTML = authScreen();
    return;
  }
  if (state.workspaceLoading || !state.workspace) {
    root.innerHTML = loadingScreen();
    return;
  }
  syncSelection();
  root.innerHTML = state.screen === "flow" ? flowScreen() : homeScreen();
}

async function loadWorkspaceForUser(user) {
  try {
    state.workspaceLoading = true;
    render();
    const workspace = await seedWorkspaceIfEmpty(user.uid);
    state.workspace = normalizeWorkspace(workspace);
    state.settingsDraft = { repName: state.workspace.repName || "", theme: state.workspace.theme || "light" };
    state.settingsOpen = false;
    state.activeGroupId = state.workspace.groups[0]?.id || null;
    state.activeFlowId = state.workspace.flows[0]?.id || null;
    state.activeStepId = state.workspace.flows[0]?.steps?.[0]?.id || null;
    state.screen = "home";
  } catch (error) {
    console.error(error);
    notify(error.message || "Could not load workspace.", "error");
  } finally {
    state.workspaceLoading = false;
    render();
  }
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;

  if (action === "switch-auth-mode") {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    state.notice = null;
    render();
    return;
  }
  if (action === "toggle-edit") { toggleEditMode(); return; }
  if (action === "go-home") { state.screen = "home"; render(); return; }
  if (action === "select-group") { state.activeGroupId = button.dataset.groupId; render(); return; }
  if (action === "open-flow") { selectFlow(button.dataset.flowId); return; }
  if (action === "go-step") { state.activeStepId = button.dataset.stepId; render(); return; }
  if (action === "toggle-settings") {
    state.settingsOpen = !state.settingsOpen;
    if (state.settingsOpen) {
      state.settingsDraft = {
        repName: state.workspace?.repName || "",
        theme: state.workspace?.theme || "light",
      };
    }
    render();
    return;
  }
  if (action === "save-settings") {
    if (!state.user || state.settingsSaving) return;
    state.settingsSaving = true;
    render();
    saveUserPreferences(state.user.uid, { repName: state.settingsDraft.repName, theme: state.settingsDraft.theme })
      .then(() => {
        if (state.workspace) {
          state.workspace.repName = state.settingsDraft.repName || "";
          state.workspace.theme = state.settingsDraft.theme || "light";
        }
        if (state.draft) {
          state.draft.repName = state.settingsDraft.repName || "";
          state.draft.theme = state.settingsDraft.theme || "light";
        }
        notify("Settings saved.", "success");
      })
      .catch((error) => {
        console.error(error);
        notify(error.message || "Could not save settings.", "error");
      })
      .finally(() => {
        state.settingsSaving = false;
        render();
      });
    return;
  }
  if (action === "sign-out") {
    signOutUser().catch((error) => notify(error.message || "Could not sign out.", "error"));
    return;
  }
  if (action === "clear-current-call") {
    clearCurrentCallContext();
    notify("Current call cleared.", "success");
    render();
    return;
  }
  if (action === "open-quote-workspace" || action === "open-quote-modal") {
    openQuoteModal();
    return;
  }
  if (action === "close-quote-modal") {
    closeQuoteModal();
    return;
  }
  if (action === "pull-quote-context") {
    pullQuoteContextFromStorage();
    return;
  }
  if (action === "lookup-zillow-inline") {
    lookupAddressInline();
    return;
  }
  if (action === "copy-call-summary") {
    const summary = callContextSummary();
    if (!summary) {
      notify("Nothing to copy yet.", "error");
      return;
    }
    navigator.clipboard.writeText(summary)
      .then(() => notify("Call summary copied.", "success"))
      .catch(() => notify("Could not copy summary.", "error"));
    return;
  }
  if (action === "add-step") { createMainStep(); return; }
  if (action === "add-branch-step") { createBranchStep(); return; }
  if (action === "add-special-step") { createSpecialStep(button.dataset.type); return; }
  if (action === "duplicate-step") { duplicateCurrentStep(); return; }
  if (action === "delete-step") { deleteCurrentStep(); return; }
  if (action === "move-step") { moveCurrentStep(button.dataset.direction); return; }
  if (action === "add-keypoint") { addItem("keyPoints"); return; }
  if (action === "remove-keypoint") { removeListItem("keyPoints", Number(button.dataset.index)); return; }
  if (action === "add-extra-item") { addItem("extraItems"); return; }
  if (action === "remove-extra-item") { removeListItem("extraItems", Number(button.dataset.index)); return; }
  if (action === "add-guarantee") { addItem("guarantees"); return; }
  if (action === "remove-guarantee") { removeListItem("guarantees", Number(button.dataset.index)); return; }
  if (action === "add-followup") { addItem("followUp"); return; }
  if (action === "remove-followup") { removeListItem("followUp", Number(button.dataset.index)); return; }
  if (action === "add-branch-row") { addBranchRow(); return; }
  if (action === "remove-branch") { removeBranch(Number(button.dataset.index)); return; }
  if (action === "add-group") { addGroup(); return; }
  if (action === "delete-group") { deleteGroup(button.dataset.groupId); return; }
  if (action === "move-group") {
    updateDraft((draft) => {
      const group = draft.groups.find((item) => item.id === button.dataset.groupId);
      if (!group) return;
      const direction = button.dataset.direction === "up" ? -1 : 1;
      const other = draft.groups.find((item) => item.order === group.order + direction);
      if (!other) return;
      const temp = group.order;
      group.order = other.order;
      other.order = temp;
    });
    return;
  }
  if (action === "add-flow") { addFlow(); return; }
  if (action === "delete-flow") { deleteFlow(button.dataset.flowId); return; }
  if (action === "export-workspace") { exportWorkspace(); return; }
  if (action === "import-workspace") { openImport(); return; }
}

function onInput(event) {
  const target = event.target;
  if (target.closest('[data-form="auth"]')) {
    state.authForm[target.name] = target.value;
    return;
  }
  if (target.dataset.role === "settings-field") {
    state.settingsDraft[target.dataset.field] = target.value;
    if (target.dataset.field === "theme") render();
    return;
  }

  if (target.dataset.role === "current-call-field") {
    const field = target.dataset.field;
    if (field === "clientPhone") {
      const formatted = formatUsPhoneInput(target.value);
      target.value = formatted;
      state.currentCall[field] = formatted;
    } else {
      state.currentCall[field] = target.value;
    }
    saveCurrentCallContext();
    return;
  }

  if (!state.editMode || !state.draft) return;

  if (target.dataset.role === "group-field") {
    const group = state.draft.groups.find((item) => item.id === target.dataset.groupId);
    if (!group) return;
    group[target.dataset.field] = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "flow-field") {
    const flow = state.draft.flows.find((item) => item.id === target.dataset.flowId);
    if (!flow) return;
    flow[target.dataset.field] = target.value;
    state.dirty = true;
    return;
  }

  const flow = flowById(state.draft, state.activeFlowId);
  const step = stepById(flow, state.activeStepId);
  if (!step) return;

  if (target.dataset.role === "step-field") {
    const field = target.dataset.field;
    if (field === "main") step.main = target.value === "true";
    else if (field === "specialType") {
      step.specialType = target.value;
      step.special = target.value !== "standard";
      if (target.value === "guarantees" && !step.guarantees.length) step.guarantees = [{ name: "Guarantee", script: "" }];
      if (target.value === "followup" && !step.followUp.length) step.followUp = [{ day: "Day 1", content: "" }];
    } else {
      step[field] = target.value;
    }
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "keypoint-field") {
    step.keyPoints[Number(target.dataset.index)] = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "extra-title") {
    if (!step.extra) step.extra = { title: "Notes", items: [] };
    step.extra.title = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "extra-item") {
    if (!step.extra) step.extra = { title: "Notes", items: [] };
    step.extra.items[Number(target.dataset.index)] = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "branch-field") {
    const branch = step.branches[Number(target.dataset.index)];
    if (!branch) return;
    branch[target.dataset.field] = target.value || null;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "guarantee-field") {
    const item = step.guarantees[Number(target.dataset.index)];
    if (!item) return;
    item[target.dataset.field] = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "followup-field") {
    const item = step.followUp[Number(target.dataset.index)];
    if (!item) return;
    item[target.dataset.field] = target.value;
    state.dirty = true;
    return;
  }

  if (target.dataset.role === "stage-label") {
    step.label = target.value;
    if (step.parentId) {
      const parent = stepById(flow, step.parentId);
      if (parent) {
        parent.branches = (parent.branches || []).map((branch) => (
          branch.targetId === step.id ? { ...branch, label: target.value || branch.label } : branch
        ));
      }
    }
    state.dirty = true;
  }
}

function onChange(event) {
  const target = event.target;
  if (target.id === "workspace-import") {
    handleImport(target.files?.[0]);
    target.value = "";
    return;
  }
  if (target.dataset.role === "current-call-field") {
    saveCurrentCallContext();
    if (target.dataset.field === "clientAddress" && target.value.trim()) {
      lookupAddressInline();
      return;
    }
    render();
  }
}

async function onSubmit(event) {
  if (event.target.dataset.form !== "auth") return;
  event.preventDefault();
  if (!isConfigured()) {
    notify("Firebase is not configured.", "error");
    return;
  }
  try {
    state.authPending = true;
    render();
    const { email, password } = state.authForm;
    if (state.authMode === "signin") await signInWithEmail(email, password);
    else await signUpWithEmail(email, password);
  } catch (error) {
    console.error(error);
    notify(error.message || "Authentication failed.", "error");
  } finally {
    state.authPending = false;
    render();
  }
}

root.addEventListener("click", onClick);

document.addEventListener("click", (event) => {
  const modalApply = event.target.closest('#quoteModalApplyBtn');
  if (modalApply) {
    event.preventDefault();
    event.stopPropagation();
    pullQuoteContextFromStorage();
    return;
  }
  const modalClose = event.target.closest('#quoteModalCloseBtn');
  if (modalClose) {
    event.preventDefault();
    event.stopPropagation();
    closeQuoteModal();
    return;
  }
  const button = event.target.closest('[data-action="close-quote-modal"], [data-action="pull-quote-context"]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const action = button.dataset.action;
  if (action === 'close-quote-modal') {
    closeQuoteModal();
    return;
  }
  if (action === 'pull-quote-context') {
    pullQuoteContextFromStorage();
  }
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.quoteModalOpen) {
    event.preventDefault();
    closeQuoteModal();
  }
});
root.addEventListener("input", onInput);
root.addEventListener("change", onChange);
root.addEventListener("submit", onSubmit);
window.addEventListener("beforeunload", beforeUnload);

subscribeToAuth(async (user) => {
  state.user = user;
  state.authReady = true;
  state.notice = null;
  state.editMode = false;
  state.draft = null;
  state.dirty = false;
  if (!user) {
    state.workspace = null;
    state.workspaceLoading = false;
    state.settingsOpen = false;
    state.settingsDraft = { repName: "", theme: "light" };
    state.currentCall = blankCurrentCall();
    state.screen = "home";
    render();
    return;
  }
  state.currentCall = loadCurrentCallContext(user.uid);
  await loadWorkspaceForUser(user);
});

window.addEventListener("storage", (event) => {
  if (event.key === QUOTE_CONTEXT_STORAGE_KEY && event.newValue && !state.quoteModalOpen) {
    // Optional passive sync when the modal is closed.
    pullQuoteContextFromStorage({ silent: true });
  }
});

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "joc:quote-context") {
    const applied = applyQuoteContext(data.payload || {}, { silent: true });
    if (applied) {
      notify("Quote data loaded into this call.", "success");
      render();
    }
  }
});

render();
