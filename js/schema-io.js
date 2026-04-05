function safeString(value) {
  return value == null ? "" : String(value);
}

function quoteString(value) {
  const str = safeString(value);
  if (str === "") return '""';
  if (/^[A-Za-z0-9 _()\/&.,:+\-]+$/.test(str) && !/^\s|\s$/.test(str)) {
    return str;
  }
  return JSON.stringify(str);
}

function pushLine(lines, indent, text = "") {
  lines.push(`${" ".repeat(indent)}${text}`);
}

function writeBlockString(lines, indent, key, value) {
  pushLine(lines, indent, `${key}: |`);
  const content = safeString(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!content.length) {
    pushLine(lines, indent + 2, "");
    return;
  }
  for (const line of content) pushLine(lines, indent + 2, line);
}

function writeScalar(lines, indent, key, value) {
  pushLine(lines, indent, `${key}: ${quoteString(value)}`);
}

function writeStringArray(lines, indent, key, items = []) {
  pushLine(lines, indent, `${key}:`);
  if (!items.length) {
    pushLine(lines, indent + 2, "[]");
    return;
  }
  for (const item of items) pushLine(lines, indent + 2, `- ${quoteString(item)}`);
}

function writeObjectArray(lines, indent, key, items = [], writer) {
  pushLine(lines, indent, `${key}:`);
  if (!items.length) {
    pushLine(lines, indent + 2, "[]");
    return;
  }
  for (const item of items) writer(lines, indent + 2, item);
}

function writeGroup(lines, indent, group) {
  pushLine(lines, indent, `- id: ${quoteString(group.id)}`);
  pushLine(lines, indent + 2, `name: ${quoteString(group.name)}`);
  pushLine(lines, indent + 2, `icon: ${quoteString(group.icon || "📞")}`);
}

function writeBranch(lines, indent, branch) {
  pushLine(lines, indent, `- label: ${quoteString(branch.label || "Branch")}`);
  pushLine(lines, indent + 2, `color: ${quoteString(branch.color || "decision")}`);
  pushLine(lines, indent + 2, `target_id: ${quoteString(branch.targetId || "")}`);
}

function writeGuarantee(lines, indent, item) {
  pushLine(lines, indent, `- name: ${quoteString(item.name || "Guarantee")}`);
  writeBlockString(lines, indent + 2, "script", item.script || "");
}

function writeFollowUp(lines, indent, item) {
  pushLine(lines, indent, `- day: ${quoteString(item.day || "Day 1")}`);
  writeBlockString(lines, indent + 2, "content", item.content || "");
}


function writeScriptAction(lines, indent, action) {
  pushLine(lines, indent, `- action: ${quoteString(action.action || "")}`);
  pushLine(lines, indent + 2, `label: ${quoteString(action.label || "")}`);
  if (action.tone) pushLine(lines, indent + 2, `tone: ${quoteString(action.tone)}`);
}

function writeScriptOption(lines, indent, option) {
  if (typeof option === "string") {
    pushLine(lines, indent, `- ${quoteString(option)}`);
    return;
  }
  pushLine(lines, indent, `- value: ${quoteString(option.value || "")}`);
  pushLine(lines, indent + 2, `label: ${quoteString(option.label || option.value || "")}`);
}

function writeScriptBlock(lines, indent, block) {
  pushLine(lines, indent, `- type: ${quoteString(block.type || "text")}`);
  if (block.text != null) writeBlockString(lines, indent + 2, "text", block.text || "");
  if (block.field != null) pushLine(lines, indent + 2, `field: ${quoteString(block.field || "")}`);
  if (block.input != null) pushLine(lines, indent + 2, `input: ${quoteString(block.input || "text")}`);
  if (block.label != null) pushLine(lines, indent + 2, `label: ${quoteString(block.label || "")}`);
  if (block.placeholder != null) pushLine(lines, indent + 2, `placeholder: ${quoteString(block.placeholder || "")}`);
  if (block.lookup === true) pushLine(lines, indent + 2, `lookup: true`);
  if (Array.isArray(block.showWhenAny)) writeStringArray(lines, indent + 2, "show_when_any", block.showWhenAny);
  if (Array.isArray(block.showWhenAll)) writeStringArray(lines, indent + 2, "show_when_all", block.showWhenAll);
  if (Array.isArray(block.actions)) writeObjectArray(lines, indent + 2, "actions", block.actions, writeScriptAction);
  if (Array.isArray(block.options)) {
    pushLine(lines, indent + 2, "options:");
    if (!block.options.length) pushLine(lines, indent + 4, "[]");
    else for (const option of block.options) writeScriptOption(lines, indent + 4, option);
  }
}

function writeStep(lines, indent, step) {
  const kind = step.special ? "special" : (step.main ? "main" : "branch");
  pushLine(lines, indent, `- id: ${quoteString(step.id)}`);
  pushLine(lines, indent + 2, `kind: ${quoteString(kind)}`);
  pushLine(lines, indent + 2, `special_type: ${quoteString(step.specialType || "standard")}`);
  pushLine(lines, indent + 2, `step_number: ${quoteString(step.num || "")}`);
  pushLine(lines, indent + 2, `sidebar_label: ${quoteString(step.label || "")}`);
  pushLine(lines, indent + 2, `title: ${quoteString(step.title || "")}`);
  writeBlockString(lines, indent + 2, "legend", step.subtitle || "");
  writeBlockString(lines, indent + 2, "script", step.script || "");
  if (Array.isArray(step.scriptBlocks) && step.scriptBlocks.length) {
    writeObjectArray(lines, indent + 2, "script_blocks", step.scriptBlocks, writeScriptBlock);
  }
  writeBlockString(lines, indent + 2, "tone_cue", step.toneCue || "");
  writeScalar(lines, indent + 2, "parent_step_id", step.parentId || "");
  writeScalar(lines, indent + 2, "next_step_id", step.next || "");
  writeStringArray(lines, indent + 2, "key_points", step.keyPoints || []);
  writeObjectArray(lines, indent + 2, "branches", step.branches || [], writeBranch);

  pushLine(lines, indent + 2, "extra:");
  if (step.extra) {
    pushLine(lines, indent + 4, `title: ${quoteString(step.extra.title || "Notes")}`);
    writeStringArray(lines, indent + 4, "items", step.extra.items || []);
  } else {
    pushLine(lines, indent + 4, "null");
  }

  writeObjectArray(lines, indent + 2, "guarantees", step.guarantees || [], writeGuarantee);
  writeObjectArray(lines, indent + 2, "follow_up", step.followUp || [], writeFollowUp);
}

function writeCallType(lines, indent, flow) {
  pushLine(lines, indent, `- id: ${quoteString(flow.id)}`);
  pushLine(lines, indent + 2, `name: ${quoteString(flow.name)}`);
  pushLine(lines, indent + 2, `icon: ${quoteString(flow.icon || "📞")}`);
  writeBlockString(lines, indent + 2, "description", flow.desc || "");
  pushLine(lines, indent + 2, `group_id: ${quoteString(flow.groupId || "general")}`);
  writeObjectArray(lines, indent + 2, "steps", flow.steps || [], writeStep);
}

export function serializeWorkspaceToText(workspace) {
  const lines = [
    "# Call Guide bulk-edit file",
    "# Edit with any AI or text editor, then import it back into the app.",
    "# Keep ids stable if you want updates to merge cleanly.",
    "schema_version: 1",
    "workspace:",
  ];

  writeScalar(lines, 2, "theme", workspace?.theme || "light");
  writeScalar(lines, 2, "rep_name", workspace?.repName || "");
  writeObjectArray(lines, 2, "groups", workspace?.groups || [], writeGroup);
  writeObjectArray(lines, 2, "call_types", workspace?.flows || [], writeCallType);
  lines.push("");
  return lines.join("\n");
}

function countIndent(line) {
  let count = 0;
  while (count < line.length && line[count] === " ") count += 1;
  return count;
}

function normalizeSource(text) {
  return String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function preprocessLines(text) {
  return normalizeSource(text).split("\n").map((raw) => ({
    raw,
    indent: countIndent(raw),
    trimmed: raw.trim(),
  }));
}

function unquote(value) {
  const str = String(value || "").trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    try {
      if (str.startsWith('"')) return JSON.parse(str);
      return str.slice(1, -1).replace(/\\'/g, "'");
    } catch {
      return str.slice(1, -1);
    }
  }
  return str;
}

function parseScalar(value) {
  const str = String(value || "").trim();
  if (str === "") return "";
  if (str === "null") return null;
  if (str === "true") return true;
  if (str === "false") return false;
  if (/^-?(0|[1-9]\d*)$/.test(str) && !/^0\d+/.test(str) && !/^-0\d+/.test(str)) return Number(str);
  return unquote(str);
}

function isSkippable(line) {
  return !line.trimmed || line.trimmed.startsWith("#");
}

function skipSkippable(lines, index) {
  let i = index;
  while (i < lines.length && isSkippable(lines[i])) i += 1;
  return i;
}

function collectBlockString(lines, startIndex, baseIndent) {
  const values = [];
  let i = startIndex;
  const blockIndent = baseIndent + 2;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trimmed) {
      values.push("");
      i += 1;
      continue;
    }
    if (line.indent < blockIndent) break;
    values.push(line.raw.slice(Math.min(blockIndent, line.raw.length)));
    i += 1;
  }
  return { value: values.join("\n"), nextIndex: i };
}

function parseObjectEntries(lines, startIndex, indent, seed = {}) {
  let i = skipSkippable(lines, startIndex);
  const obj = seed;
  while (i < lines.length) {
    const line = lines[i];
    if (isSkippable(line)) { i += 1; continue; }
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`Unexpected indentation near: ${line.raw}`);
    }
    if (line.trimmed.startsWith("- ")) break;
    const colonIndex = line.trimmed.indexOf(":");
    if (colonIndex < 0) throw new Error(`Expected key: value near: ${line.raw}`);
    const key = line.trimmed.slice(0, colonIndex).trim();
    const rest = line.trimmed.slice(colonIndex + 1).trim();
    if (rest === "|") {
      const block = collectBlockString(lines, i + 1, indent);
      obj[key] = block.value;
      i = block.nextIndex;
      continue;
    }
    if (rest === "") {
      const nestedStart = skipSkippable(lines, i + 1);
      if (nestedStart >= lines.length || lines[nestedStart].indent <= indent) {
        obj[key] = null;
        i = nestedStart;
        continue;
      }
      const nested = parseNode(lines, nestedStart, indent + 2);
      obj[key] = nested.value;
      i = nested.nextIndex;
      continue;
    }
    obj[key] = parseScalar(rest);
    i += 1;
  }
  return { value: obj, nextIndex: i };
}

function parseArray(lines, startIndex, indent) {
  let i = skipSkippable(lines, startIndex);
  const arr = [];
  while (i < lines.length) {
    const line = lines[i];
    if (isSkippable(line)) { i += 1; continue; }
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`Unexpected indentation near: ${line.raw}`);
    if (!line.trimmed.startsWith("- ")) break;

    const rest = line.trimmed.slice(2).trim();
    if (rest === "") {
      const nested = parseNode(lines, skipSkippable(lines, i + 1), indent + 2);
      arr.push(nested.value);
      i = nested.nextIndex;
      continue;
    }

    const colonIndex = rest.indexOf(":");
    if (colonIndex > 0) {
      const key = rest.slice(0, colonIndex).trim();
      const rawValue = rest.slice(colonIndex + 1).trim();
      const seed = {};
      if (rawValue === "|") {
        const block = collectBlockString(lines, i + 1, indent + 2);
        seed[key] = block.value;
        const parsed = parseObjectEntries(lines, block.nextIndex, indent + 2, seed);
        arr.push(parsed.value);
        i = parsed.nextIndex;
        continue;
      }
      if (rawValue === "") {
        const nestedStart = skipSkippable(lines, i + 1);
        if (nestedStart < lines.length && lines[nestedStart].indent > indent) {
          const nested = parseNode(lines, nestedStart, indent + 2);
          seed[key] = nested.value;
          const parsed = parseObjectEntries(lines, nested.nextIndex, indent + 2, seed);
          arr.push(parsed.value);
          i = parsed.nextIndex;
          continue;
        }
        seed[key] = null;
      } else {
        seed[key] = parseScalar(rawValue);
      }
      const parsed = parseObjectEntries(lines, i + 1, indent + 2, seed);
      arr.push(parsed.value);
      i = parsed.nextIndex;
      continue;
    }

    arr.push(parseScalar(rest));
    i += 1;
  }
  return { value: arr, nextIndex: i };
}

function parseNode(lines, startIndex, indent) {
  const i = skipSkippable(lines, startIndex);
  if (i >= lines.length) return { value: null, nextIndex: i };
  const line = lines[i];
  if (line.indent < indent) return { value: null, nextIndex: i };
  if (line.trimmed === "[]") return { value: [], nextIndex: i + 1 };
  if (line.trimmed === "null") return { value: null, nextIndex: i + 1 };
  if (line.trimmed.startsWith("- ")) return parseArray(lines, i, indent);
  return parseObjectEntries(lines, i, indent, {});
}

function normalizeImportedStep(step, index) {
  const kind = safeString(step.kind || "main").toLowerCase();
  const specialType = safeString(step.special_type || step.specialType || "standard") || "standard";
  const isSpecial = kind === "special" || specialType === "guarantees" || specialType === "followup";
  return {
    id: safeString(step.id) || `step-${index + 1}`,
    num: safeString(step.step_number || step.num || ""),
    label: safeString(step.sidebar_label || step.label || step.title || `Step ${index + 1}`),
    title: safeString(step.title || step.sidebar_label || `Step ${index + 1}`),
    subtitle: safeString(step.legend || step.subtitle || ""),
    script: safeString(step.script || ""),
    scriptBlocks: Array.isArray(step.script_blocks || step.scriptBlocks) ? (step.script_blocks || step.scriptBlocks).map((block, blockIndex) => ({
      type: safeString(block.type || "text") || "text",
      text: safeString(block.text || ""),
      field: safeString(block.field || ""),
      input: safeString(block.input || "text") || "text",
      label: safeString(block.label || ""),
      placeholder: safeString(block.placeholder || ""),
      lookup: Boolean(block.lookup),
      showWhenAny: Array.isArray(block.show_when_any || block.showWhenAny) ? (block.show_when_any || block.showWhenAny).map((item) => safeString(item)) : [],
      showWhenAll: Array.isArray(block.show_when_all || block.showWhenAll) ? (block.show_when_all || block.showWhenAll).map((item) => safeString(item)) : [],
      actions: Array.isArray(block.actions) ? block.actions.map((action) => ({
        action: safeString(action.action || ""),
        label: safeString(action.label || ""),
        tone: safeString(action.tone || ""),
      })) : [],
      options: Array.isArray(block.options) ? block.options.map((option) => (
        typeof option === "string"
          ? { value: safeString(option), label: safeString(option) }
          : { value: safeString(option.value || ""), label: safeString(option.label || option.value || "") }
      )) : [],
      order: Number.isFinite(block.order) ? Number(block.order) : blockIndex,
    })) : [],
    toneCue: safeString(step.tone_cue || step.toneCue || ""),
    keyPoints: Array.isArray(step.key_points || step.keyPoints) ? (step.key_points || step.keyPoints).map((item) => safeString(item)) : [],
    branches: Array.isArray(step.branches) ? step.branches.map((branch) => ({
      label: safeString(branch.label || "Branch"),
      color: safeString(branch.color || "decision"),
      targetId: safeString(branch.target_id || branch.targetId || "") || null,
    })) : [],
    main: kind !== "branch",
    special: isSpecial,
    specialType: isSpecial ? specialType : "standard",
    parentId: safeString(step.parent_step_id || step.parentId || "") || null,
    next: safeString(step.next_step_id || step.next || "") || null,
    guarantees: Array.isArray(step.guarantees) ? step.guarantees.map((item) => ({
      name: safeString(item.name || "Guarantee"),
      script: safeString(item.script || ""),
    })) : [],
    followUp: Array.isArray(step.follow_up || step.followUp) ? (step.follow_up || step.followUp).map((item) => ({
      day: safeString(item.day || "Day 1"),
      content: safeString(item.content || ""),
    })) : [],
    extra: step.extra && typeof step.extra === "object" ? {
      title: safeString(step.extra.title || "Notes"),
      items: Array.isArray(step.extra.items) ? step.extra.items.map((item) => safeString(item)) : [],
    } : null,
    order: Number.isFinite(step.order) ? Number(step.order) : index,
  };
}

function schemaToWorkspace(schema) {
  if (!schema || typeof schema !== "object") throw new Error("Import file is empty or invalid.");
  const workspaceRoot = schema.workspace || schema;
  const groups = Array.isArray(workspaceRoot.groups) ? workspaceRoot.groups.map((group, index) => ({
    id: safeString(group.id) || `group-${index + 1}`,
    name: safeString(group.name || `Group ${index + 1}`),
    icon: safeString(group.icon || "📞"),
    order: index,
  })) : [];

  const callTypes = Array.isArray(workspaceRoot.call_types)
    ? workspaceRoot.call_types
    : Array.isArray(workspaceRoot.flows)
      ? workspaceRoot.flows
      : [];

  const flows = callTypes.map((flow, index) => ({
    id: safeString(flow.id) || `flow-${index + 1}`,
    name: safeString(flow.name || flow.label || `Call Type ${index + 1}`),
    icon: safeString(flow.icon || "📞"),
    desc: safeString(flow.description || flow.desc || ""),
    groupId: safeString(flow.group_id || flow.groupId || groups[0]?.id || "general"),
    order: index,
    steps: Array.isArray(flow.steps) ? flow.steps.map((step, stepIndex) => normalizeImportedStep(step, stepIndex)) : [],
  }));

  return {
    theme: safeString(workspaceRoot.theme || "light") || "light",
    repName: safeString(workspaceRoot.rep_name || workspaceRoot.repName || ""),
    groups,
    flows,
  };
}

export function parseWorkspaceText(text) {
  const source = normalizeSource(text).trim();
  if (!source) throw new Error("Import file is empty.");
  if (source.startsWith("{") || source.startsWith("[")) return JSON.parse(source);
  const parsed = parseNode(preprocessLines(source), 0, 0).value;
  return schemaToWorkspace(parsed);
}

export function validateWorkspaceSchema(workspace) {
  const issues = [];
  if (!workspace || typeof workspace !== "object") {
    issues.push("Workspace is missing.");
    return issues;
  }
  if (!Array.isArray(workspace.groups) || !workspace.groups.length) issues.push("At least one group is required.");
  if (!Array.isArray(workspace.flows)) issues.push("call_types must be a list.");

  const flowIds = new Set();
  const groupIds = new Set((workspace.groups || []).map((group) => group.id));

  for (const flow of workspace.flows || []) {
    if (!flow.id) issues.push(`A call type is missing an id.`);
    if (flowIds.has(flow.id)) issues.push(`Duplicate call type id: ${flow.id}`);
    flowIds.add(flow.id);
    if (!flow.groupId || !groupIds.has(flow.groupId)) issues.push(`Call type ${flow.id} points to missing group ${flow.groupId}.`);

    const stepIds = new Set();
    for (const step of flow.steps || []) {
      if (!step.id) issues.push(`A step in ${flow.id} is missing an id.`);
      if (stepIds.has(step.id)) issues.push(`Duplicate step id ${step.id} in ${flow.id}.`);
      stepIds.add(step.id);
      for (const block of step.scriptBlocks || []) {
        if (block.type === "field" && !block.field) issues.push(`A field block in ${flow.id}/${step.id} is missing a field binding.`);
        if (block.type === "action_row") {
          for (const action of block.actions || []) {
            if (!action.action) issues.push(`An action in ${flow.id}/${step.id} is missing an action name.`);
          }
        }
      }
    }
    for (const step of flow.steps || []) {
      if (step.parentId && !stepIds.has(step.parentId)) issues.push(`Step ${step.id} in ${flow.id} points to missing parent_step_id ${step.parentId}.`);
      if (step.next && !stepIds.has(step.next)) issues.push(`Step ${step.id} in ${flow.id} points to missing next_step_id ${step.next}.`);
      for (const branch of step.branches || []) {
        if (branch.targetId && !stepIds.has(branch.targetId)) issues.push(`Branch "${branch.label}" in ${flow.id} points to missing target_id ${branch.targetId}.`);
      }
    }
  }
  return issues;
}

export function mergeWorkspaceByIds(baseWorkspace, importedWorkspace) {
  const base = structuredClone(baseWorkspace);
  const imported = structuredClone(importedWorkspace);

  const groupMap = new Map((base.groups || []).map((group) => [group.id, group]));
  for (const group of imported.groups || []) groupMap.set(group.id, group);
  base.groups = Array.from(groupMap.values());

  const flowMap = new Map((base.flows || []).map((flow) => [flow.id, flow]));
  for (const flow of imported.flows || []) flowMap.set(flow.id, flow);
  base.flows = Array.from(flowMap.values());

  if (imported.theme) base.theme = imported.theme;
  if (Object.prototype.hasOwnProperty.call(imported, "repName")) base.repName = imported.repName || "";
  return base;
}
