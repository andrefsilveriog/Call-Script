import {
  isConfigured,
  subscribeToAuth,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  saveWorkspace,
  seedWorkspaceIfEmpty,
} from "./firebase-service.js";
import { DEFAULT_GROUPS } from "./defaults.js";

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
};

const BRANCH_TONES = {
  flow: "var(--white)",
  money: "#fff7ea",
  decision: "#f4efff",
  danger: "#fff0f0",
  back: "#edf2f7",
  success: "#ebfbf7",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderText(value = "") {
  return escapeHtml(value).replaceAll("\n", "<br>");
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

  const result = { theme: "light", groups, flows };
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

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const next = normalizeWorkspace(parsed);
      if (state.editMode) {
        state.draft = next;
        state.dirty = true;
      } else {
        state.workspace = next;
      }
      syncSelection();
      render();
      notify("Import loaded. Save to keep it.", "success");
    } catch (error) {
      console.error(error);
      notify("Could not import that file.", "error");
    }
  };
  reader.readAsText(file);
}

function exportWorkspace() {
  const blob = new Blob([JSON.stringify(workspaceSource(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "call-guide-workspace.json";
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

  return `
    <div class="shell">
      <div class="utility-row">
        <div>
          <h1 class="home-title">Select call type</h1>
          <div class="home-intro">Pick the call, then follow the steps across the top.</div>
        </div>
        <div></div>
        <div class="utility-actions">
          <button class="small-btn" data-action="export-workspace">Export</button>
          <button class="small-btn" data-action="import-workspace">Import</button>
          <input id="workspace-import" type="file" accept="application/json" class="hidden" />
          <button class="small-btn" data-action="sign-out">Sign out</button>
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

        ${state.editMode ? renderHomeBuilder() : ""}
        ${renderNotice()}
      </div>

      ${renderFab()}
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
              <button class="small-btn" data-action="export-workspace">Export</button>
              <button class="small-btn" data-action="import-workspace">Import</button>
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

function renderScript(step) {
  if (step.special && step.specialType === "guarantees") {
    return `
      <div class="page-section">
        ${step.guarantees.map((item, index) => `
          <div class="guarantee-card">
            ${state.editMode ? `
              <div class="guarantee-row">
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
        : `<div class="script-text">${renderText(step.script || "")}</div>`}
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
        <ul class="keypoints-list">${step.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
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
        <span class="section-label">${escapeHtml(extra.title || "Notes")}</span>
        <ul class="extra-list">${(extra.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
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
          <div class="topbar-actions"><button class="small-btn" data-action="sign-out">Sign out</button></div>
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
        <div class="topbar-actions">
          <button class="small-btn" data-action="sign-out">Sign out</button>
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
    </div>
  `;
}

function renderFab() {
  if (!state.user || state.workspaceLoading) return "";
  return `<button class="fab" data-action="toggle-edit" aria-label="${state.editMode ? "Save" : "Edit"}">${state.saving ? "…" : state.editMode ? "✓" : "✎"}</button>`;
}

function render() {
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
  if (action === "sign-out") {
    signOutUser().catch((error) => notify(error.message || "Could not sign out.", "error"));
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
    state.screen = "home";
    render();
    return;
  }
  await loadWorkspaceForUser(user);
});

render();
