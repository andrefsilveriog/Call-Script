export function exportWorkspaceToText(workspace) {
  return JSON.stringify(workspace, null, 2);
}

export function importWorkspaceFromText(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid workspace file.');
  if (!parsed.workspace || !Array.isArray(parsed.workspace.groups) || !Array.isArray(parsed.workspace.call_types)) {
    throw new Error('Workspace file is missing required keys.');
  }
  return parsed;
}
