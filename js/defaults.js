export const DEFAULT_GROUPS = [
  { id: "inbound", name: "Inbound", icon: "📥", order: 0 },
  { id: "outbound", name: "Outbound", icon: "📤", order: 1 },
];

export function buildSeedWorkspace() {
  return {
    theme: "light",
    repName: "",
    groups: DEFAULT_GROUPS.map((group) => ({ ...group })),
    flows: [],
  };
}
