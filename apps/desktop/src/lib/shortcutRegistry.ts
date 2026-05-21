export type ShortcutActionId =
  | "executeSql"
  | "saveSql"
  | "newQuery"
  | "closeTab"
  | "focusSearch"
  | "refreshData"
  | "toggleTranspose"
  | "cancelSearch";

export type ShortcutScope = "global" | "editor" | "grid" | "search";

export interface ShortcutDefinition {
  id: ShortcutActionId;
  labelKey: string;
  scope: ShortcutScope;
  defaultShortcut: string;
}

export type ShortcutSettings = Record<ShortcutActionId, string>;

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "executeSql",
    labelKey: "settings.shortcutExecuteSql",
    scope: "editor",
    defaultShortcut: "Mod+Enter",
  },
  {
    id: "saveSql",
    labelKey: "settings.shortcutSaveSql",
    scope: "editor",
    defaultShortcut: "Mod+S",
  },
  {
    id: "newQuery",
    labelKey: "settings.shortcutNewQuery",
    scope: "global",
    defaultShortcut: "Mod+T",
  },
  {
    id: "closeTab",
    labelKey: "settings.shortcutCloseTab",
    scope: "global",
    defaultShortcut: "Meta+W",
  },
  {
    id: "focusSearch",
    labelKey: "settings.shortcutFocusSearch",
    scope: "global",
    defaultShortcut: "Mod+F",
  },
  {
    id: "refreshData",
    labelKey: "settings.shortcutRefreshData",
    scope: "global",
    defaultShortcut: "F5",
  },
  {
    id: "toggleTranspose",
    labelKey: "settings.shortcutToggleTranspose",
    scope: "grid",
    defaultShortcut: "Tab",
  },
  {
    id: "cancelSearch",
    labelKey: "settings.shortcutCancelSearch",
    scope: "search",
    defaultShortcut: "Escape",
  },
];

export const DEFAULT_SHORTCUT_SETTINGS: ShortcutSettings = Object.fromEntries(
  SHORTCUT_DEFINITIONS.map((definition) => [definition.id, definition.defaultShortcut]),
) as ShortcutSettings;

export function normalizeShortcutSettings(settings?: Partial<ShortcutSettings>): ShortcutSettings {
  return Object.fromEntries(
    SHORTCUT_DEFINITIONS.map((definition) => [
      definition.id,
      typeof settings?.[definition.id] === "string" && settings[definition.id]?.trim()
        ? settings[definition.id]
        : definition.defaultShortcut,
    ]),
  ) as ShortcutSettings;
}

export function shortcutToCodeMirrorKey(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => (part.length === 1 ? part.toLowerCase() : part))
    .join("-");
}

export function formatShortcut(shortcut: string, platform = globalThis.navigator?.platform || ""): string {
  const isMac = platform.toLowerCase().includes("mac");
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") return isMac ? "Cmd" : "Ctrl";
      if (part === "Meta") return isMac ? "Cmd" : "Meta";
      return part;
    })
    .join("+");
}

export function findShortcutConflict(
  actionId: ShortcutActionId,
  shortcut: string,
  shortcuts: ShortcutSettings,
): ShortcutActionId | null {
  const definition = SHORTCUT_DEFINITIONS.find((item) => item.id === actionId);
  if (!definition) return null;

  const conflict = SHORTCUT_DEFINITIONS.find(
    (item) => item.id !== actionId && item.scope === definition.scope && shortcuts[item.id] === shortcut,
  );
  return conflict?.id ?? null;
}
