import type {
  ChatDTO,
  ChatMessageDTO,
  ChatUpdateDTO,
  ConnectionProfileDTO,
  LlmMessageDTO,
  PromptBlockDTO,
  PromptVariableValuesDTO,
  RequestInitDTO,
  TokenCountOptionsDTO,
  TokenCountResultDTO,
  WorldBookCreateDTO,
  WorldBookDTO,
  WorldBookEntryCreateDTO,
  WorldBookEntryDTO,
  WorldBookEntryUpdateDTO,
  WorldBookUpdateDTO,
} from "./api.js";
import type { SpindleComponentsHelper } from "./components.js";
import type { SpindleHostDescriptorV1, SpindleHostLocaleAPI } from "./host.js";
import type { SpindleThemeAuthoringAPI } from "./theme.js";

/** A chat-message DOM element paired with its stable message id. */
export interface SpindleMessageElement {
  /** Stable message id (matches the message's id in the host's data store). */
  messageId: string;
  /** Currently-mounted bubble root element for that message. */
  element: Element;
}

/** DOM helper API provided to frontend extension modules. */
export interface SpindleDOMHelper {
  /**
   * Inject sanitized HTML into the host document at the given target and
   * return the wrapper element containing the parsed content.
   *
   * **Element identity is preserved across chat-list virtualization.**
   * When the injection lands inside a chat-message bubble, the host
   * registers the wrapper and *moves* (not recreates) it back into place
   * when the bubble next mounts. That means form-control state, event
   * listeners bound to the wrapper subtree, and any refs the extension is
   * holding all survive scroll-away/scroll-back cycles. Extensions can
   * cache the returned Element and trust it indefinitely until they
   * explicitly retire it via `uninject()` or `cleanup()`.
   *
   * To deliberately remove an injection, call `uninject(wrapper)` — NOT
   * `wrapper.remove()`. The latter detaches the wrapper but leaves the
   * registry record in place, so the host will resurrect the wrapper on
   * the next bubble remount.
   *
   * Injections outside any chat-message bubble (sidebar, modals, toolbar)
   * are unaffected by virtualization and don't go through replay — they
   * stay attached wherever the extension put them.
   */
  inject(target: string | Element, html: string, position?: InsertPosition): Element;

  /**
   * Retire an injection previously returned by `inject()`. Removes the
   * wrapper from the DOM and drops its replay registration so the host
   * won't restore it on future bubble remounts. No-op if the element
   * isn't a recognised Spindle injection wrapper.
   */
  uninject(element: Element): void;

  /** Create a style element in the host document. Returns a removal function. */
  addStyle(css: string): () => void;

  /** Create an element in the host document with optional attributes. */
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, string>
  ): HTMLElementTagNameMap[K];

  /** Create a host-managed sandboxed iframe for isolated scriptable content. */
  createSandboxFrame(options: SpindleSandboxFrameOptions): SpindleSandboxFrameHandle;

  /** Query inside the extension-owned host DOM. */
  query(selector: string): Element | null;

  /** Query all matches inside the extension-owned host DOM. */
  queryAll(selector: string): Element[];

  /**
   * Resolve the chat message that contains the given DOM element. Walks
   * up the DOM tree from `target` looking for the host's message-bubble
   * anchor and returns the stable message id of the containing message,
   * or `null` when `target` isn't inside any chat message (e.g. it's in
   * the sidebar, a modal, or a floating widget).
   *
   * Prefer this over reading host-private DOM attributes directly — the
   * underlying attribute name is an implementation detail of the host
   * and may change; this method is the stable public contract.
   *
   * Typical use: an extension injects content into a message bubble and
   * needs the stable id to persist per-message state, key event
   * handlers on the message id, or call `ctx.messages.renderWidget()`
   * with the right id.
   */
  getMessageId(target: Element): string | null;

  /**
   * Find the chat-message bubble element currently mounted in the DOM
   * for the given stable message id. Returns `null` when the message
   * isn't currently rendered — the chat message list is virtualized, so
   * only bubbles near the viewport (plus a small overscan window) have
   * DOM at any moment.
   *
   * Typical use: extension wants to attach content to a specific known
   * message id. If `null` comes back, the bubble isn't currently
   * mounted. Injections previously made via `dom.inject()` against a
   * bubble element are auto-replayed by the host (with the original
   * Element identity preserved — see `inject()` for the full contract)
   * when that bubble next mounts, so extensions don't need to re-inject
   * on scroll themselves.
   */
  findMessageElement(messageId: string): Element | null;

  /**
   * Enumerate every chat message bubble currently mounted in the DOM,
   * paired with its stable message id. The returned list reflects only
   * what the virtualizer has rendered (typically the viewport plus a
   * small overscan window), so it changes as the user scrolls.
   *
   * Typical use: extension sweeps every visible message on setup or in
   * response to a chat-changed event to apply per-message decoration.
   */
  listMessageElements(): SpindleMessageElement[];

  /** Remove all DOM created by the extension helper. */
  cleanup(): void;
}

export type SpindleMountPoint =
  | "sidebar"
  | "chat_header_left"
  | "chat_header_center"
  | "chat_header_right"
  | "chat_top_dock"
  | "chat_bottom_dock"
  | "chat_surface_side"
  | "chat_sidebar_left"
  | "chat_sidebar_right"
  | "chat_stream_before"
  | "chat_stream_after"
  | "chat_empty_state"
  | "chat_composer_above"
  | "chat_composer_below"
  | "chat_input_tools_left"
  | "chat_input_tools_right"
  | "chat_actions"
  | "chat_toolbar"
  | "message_header"
  | "message_body_before"
  | "message_body_after"
  | "message_footer"
  | "message_actions"
  | "message_edit_actions"
  | "message_context_menu"
  | "message_swipe_indicators"
  | "landing_header"
  | "landing_hero"
  | "landing_characters"
  | "landing_recent_chats"
  | "landing_footer"
  | "sidebar_top"
  | "sidebar_bottom"
  | "drawer_tab"
  | "drawer_header_actions"
  | "drawer_footer"
  | "character_editor_tab"
  | "character_browser_card_actions"
  | "preset_editor_tab"
  | "preset_editor_toolbar"
  | "persona_editor_tab"
  | "world_book_entry_table"
  | "world_book_entry_row"
  | "world_book_entry_editor"
  | "world_book_entry_toolbar"
  | "lorebook_workspace"
  | "lorebook_half_workspace"
  | "loom_builder_toolbar"
  | "loom_builder_inspector"
  | "regex_entry_row"
  | "settings_tab"
  | "settings_section"
  | "settings_card_actions"
  | "settings_extensions"
  | "modal_header_actions"
  | "modal_footer_actions"
  | "command_palette_actions"
  | "manage_chats_actions"
  | "prompt_variables_toolbar";

// ── Drawer Tab ──

/**
 * Contextual documentation displayed by Lumiverse using its native
 * guide viewer.
 *
 * Guide Markdown is rendered and sanitized by the host application.
 */
export interface SpindleGuideDefinition {
  /** Markdown content for the guide. */
  markdown: string;

  /**
   * Optional title shown by the guide viewer.
   * Falls back to the title of the owning tab.
   */
  title?: string;
}

export interface SpindleDrawerTabOptions {
  /** Unique tab identifier. Used internally for routing and state. */
  id: string;
  /** Full display title shown in the panel header and command palette listing. */
  title: string;
  /** Short label shown beneath the sidebar icon (max ~8 chars, truncated with ellipsis). Falls back to `title` if omitted. */
  shortName?: string;
  /** One-line description shown in the command palette. Falls back to "Open {title} extension tab" if omitted. */
  description?: string;
  /** Keywords for command palette fuzzy search (e.g. ["settings", "config", "options"]). The extension name is always included automatically. */
  keywords?: string[];
  /** Title shown in the panel header navbar. Falls back to `title` if omitted. Useful when the header needs a shorter label than the command palette entry. */
  headerTitle?: string;
  /** Optional contextual documentation for this tab. */
  guide?: SpindleGuideDefinition;
  /** URL to a 16x16 or 24x24 icon image. Mutually exclusive with `iconSvg`. */
  iconUrl?: string;
  /** Inline SVG string for the tab icon. Mutually exclusive with `iconUrl`. */
  iconSvg?: string;
}

export interface SpindleDrawerTabHandle {
  root: HTMLElement;
  tabId: string;
  setTitle(title: string): void;
  /** Update the short label shown beneath the sidebar icon. */
  setShortName(shortName: string): void;
  setBadge(text: string | null): void;
  activate(): void;
  destroy(): void;
  /** Register a callback fired when the active drawer tab switches to this tab. Returns an unsubscribe function. */
  onActivate(handler: () => void): () => void;
}

// ── Character Editor Tab ──

export interface SpindleCharacterEditorTabOptions {
  /** Unique tab identifier within the current extension. */
  id: string;
  /** Label shown in the character editor tab bar. */
  title: string;
  /** Optional contextual documentation for this tab. */
  guide?: SpindleGuideDefinition;
}

export interface SpindleCharacterEditorTabHandle {
  root: HTMLElement;
  tabId: string;
  setTitle(title: string): void;
  activate(): void;
  destroy(): void;
  /** Register a callback fired when the active character-editor tab switches to this tab. */
  onActivate(handler: () => void): () => void;
}

export interface SpindleCharacterEditorState {
  /** Whether the character editor modal is currently open. */
  open: boolean;
  /** Character currently being edited, or `null` when the modal is closed. */
  characterId: string | null;
  /** Active built-in or extension tab id inside the editor modal. */
  activeTabId: string | null;
  /** Current draft extensions blob visible to the editor. */
  extensions: Record<string, any>;
}

export interface SpindleCharacterEditorSaveOptions {
  /** Persist immediately instead of using the host's debounced save path. */
  immediate?: boolean;
}

export interface SpindleCharacterEditorHelper {
  /** Read the current editor snapshot. */
  getState(): SpindleCharacterEditorState;
  /** Subscribe to editor open/close, tab, character, and extensions changes. */
  onChange(handler: (state: SpindleCharacterEditorState) => void): () => void;
  /** Replace the draft extensions object shown in the editor. */
  setExtensions(extensions: Record<string, any>, options?: SpindleCharacterEditorSaveOptions): void;
  /** Atomically derive the next draft extensions object from the current one. */
  updateExtensions(
    mutator: (extensions: Record<string, any>) => Record<string, any>,
    options?: SpindleCharacterEditorSaveOptions,
  ): void;
  /** Immediately persist any pending draft extension changes. */
  flush(): Promise<void>;
}

// ── Preset Editor Tab ──

export interface SpindlePresetEditorTabOptions {
  /** Unique tab identifier within the current extension. */
  id: string;
  /** Label shown in the Loom preset editor tab bar. */
  title: string;
  /** Optional contextual documentation for this tab. */
  guide?: SpindleGuideDefinition;
}

export interface SpindlePresetEditorTabHandle {
  root: HTMLElement;
  tabId: string;
  setTitle(title: string): void;
  activate(): void;
  destroy(): void;
  /** Register a callback fired when the active preset-editor tab switches to this tab. */
  onActivate(handler: () => void): () => void;
}

/** Extension-owned root placed above Loom's list and editor branches. */
export interface SpindlePresetEditorToolbarItemOptions {
  /** Unique toolbar item identifier within the current extension. */
  id: string;
  /** Required accessible label for the extension-owned toolbar root. */
  ariaLabel: string;
}

export interface SpindlePresetEditorToolbarItemHandle {
  readonly root: HTMLElement;
  readonly itemId: string;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/** Mutable, editor-native snapshot of the current Loom preset draft. */
export interface SpindlePresetEditorDraft {
  id: string;
  name: string;
  blocks: PromptBlockDTO[];
  parameters: Record<string, unknown>;
  prompts: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SpindlePresetEditorState {
  /** Whether a Loom preset editor instance is currently mounted. */
  open: boolean;
  /** Preset currently being edited, or `null` when none is selected. */
  presetId: string | null;
  /** Active built-in or extension tab id inside the preset editor. */
  activeTabId: string | null;
  /** Current draft. Callers receive a structured clone. */
  preset: SpindlePresetEditorDraft | null;
}

export interface SpindlePresetEditorSaveOptions {
  /** Persist immediately instead of using the host's debounced save path. */
  immediate?: boolean;
}

export interface SpindlePresetEditorHelper {
  getState(): SpindlePresetEditorState;
  onChange(handler: (state: SpindlePresetEditorState) => void): () => void;
  /** Atomically derive the next editor draft from the latest pending draft. */
  updatePreset(
    mutator: (preset: SpindlePresetEditorDraft) => SpindlePresetEditorDraft,
    options?: SpindlePresetEditorSaveOptions,
  ): void;
  /** Immediately persist and await any pending draft changes. */
  flush(): Promise<void>;
  /**
   * Cooperative, extension-identifier-scoped metadata access. This does not
   * sandbox same-origin extension code; it prevents accidental whole-draft
   * writes through the supported helper.
   */
  readonly extension: SpindlePresetEditorScopedHelper;
}

export type SpindlePresetEditorBuiltinTabId = "blocks";

export interface SpindlePresetEditorExtensionState {
  readonly open: boolean;
  readonly presetId: string | null;
  readonly activeTabId: string | null;
  /** Detached array cloned from the host draft. */
  readonly blocks: readonly PromptBlockDTO[];
  /** Detached prompt-variable values cloned from the host draft. */
  readonly promptVariableValues: Readonly<PromptVariableValuesDTO>;
  /** The raw metadata value currently owned by the calling extension. */
  readonly metadata: unknown;
}

export interface SpindlePresetEditorScopedHelper {
  getState(): SpindlePresetEditorExtensionState;
  onChange(handler: (state: SpindlePresetEditorExtensionState) => void): () => void;
  setMetadata(value: Record<string, unknown>, options?: SpindlePresetEditorSaveOptions): void;
  updateMetadata(
    mutator: (current: unknown) => Record<string, unknown>,
    options?: SpindlePresetEditorSaveOptions,
  ): void;
  activateBuiltinTab(tab: SpindlePresetEditorBuiltinTabId): void;
  flush(): Promise<void>;
}

// ── Float Widget ──

export interface SpindleFloatWidgetOptions {
  width?: number;
  height?: number;
  initialPosition?: { x: number; y: number };
  snapToEdge?: boolean;
  tooltip?: string;
  /** Strip default container chrome (border, background, shadow, border-radius).
   *  The extension fully owns the visual presentation. */
  chromeless?: boolean;
  /** When true, the widget is created in fullscreen mode anchored to the
   *  viewport origin (0,0) and sized to fill the entire viewport. */
  fullscreen?: boolean;
}

export interface SpindleFloatWidgetHandle {
  root: HTMLElement;
  widgetId: string;
  moveTo(x: number, y: number): void;
  getPosition(): { x: number; y: number };
  /** Update the widget's rendered width/height in the host container. */
  setSize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  /** Toggle fullscreen mode. When enabled the host resizes the widget to
   *  fill the viewport and anchors it at (0,0). Disabling restores the
   *  previous size and position. */
  setFullscreen(fullscreen: boolean): void;
  /** Returns true when the widget is currently in fullscreen mode. */
  isFullscreen(): boolean;
  destroy(): void;
  onDragEnd(handler: (pos: { x: number; y: number }) => void): () => void;
}

// ── Dock Panel ──

export type SpindleDockEdge = "left" | "right" | "top" | "bottom";

export interface SpindleDockPanelOptions {
  edge: SpindleDockEdge;
  title: string;
  size: number;
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
  iconUrl?: string;
  startCollapsed?: boolean;
  /** Remove the host panel chrome so the extension can render its own surface.
   *  Defaults to false. */
  chromeless?: boolean;
  /** Center the extension root within the dock's content area.
   *  Defaults to false. */
  centerContent?: boolean;
}

export interface SpindleDockPanelHandle {
  root: HTMLElement;
  panelId: string;
  collapse(): void;
  expand(): void;
  isCollapsed(): boolean;
  setTitle(title: string): void;
  /** Update the dock's current size, clamped to its configured bounds. */
  setSize(size: number): void;
  /** Update the dock's minimum size and reconcile its current bounds. */
  setMinSize(size: number): void;
  /** Update the dock's maximum size and reconcile its current bounds. */
  setMaxSize(size: number): void;
  destroy(): void;
  onVisibilityChange(handler: (visible: boolean) => void): () => void;
}

// ── Tab Mobility ──

/** Where a built-in drawer tab currently lives. */
export type SpindleTabLocation =
  | { kind: "main-drawer" }
  | { kind: "container"; containerId: string };

// ── App Mount ──

export interface SpindleAppMountOptions {
  className?: string;
  position?: "start" | "end" | "app-overlay";
}

export interface SpindleAppMountHandle {
  root: HTMLElement;
  mountId: string;
  setVisible(visible: boolean): void;
  destroy(): void;
}

// ── Input Bar Action ──

export interface SpindleInputBarActionOptions {
  id: string;
  label: string;
  subtitle?: string;
  iconSvg?: string;
  iconUrl?: string;
  enabled?: boolean;
}

export interface SpindleInputBarActionHandle {
  actionId: string;
  setLabel(label: string): void;
  setSubtitle(subtitle?: string): void;
  setEnabled(enabled: boolean): void;
  onClick(handler: () => void): () => void;
  destroy(): void;
}

// ── Sandboxed Frame ──

export interface SpindleSandboxFrameOptions {
  /** HTML document or fragment rendered inside the sandboxed iframe. */
  html: string;
  /** Automatically resize the host iframe to fit the child content. Default: `true`. */
  autoResize?: boolean;
  /** Initial host iframe height in CSS pixels. Default: `minHeight` or `40`. */
  initialHeight?: number;
  /** Minimum host iframe height in CSS pixels. Default: `40`. */
  minHeight?: number;
  /** Maximum host iframe height in CSS pixels. Default: `4000`. */
  maxHeight?: number;
  /**
   * Opt this frame into CSP 'unsafe-eval' so the iframe can use eval / new
   * Function (e.g. frameworks that compile templates at runtime). Requires the
   * extension to hold the privileged `unsafe_eval` permission, otherwise the
   * host ignores this and the frame's CSP stays default (unsafe-inline only).
   * Default: false.
   */
  allowEval?: boolean;
}

export interface SpindleSandboxFrameHandle {
  /** The sandboxed iframe element. Extensions may place and style it like any other element. */
  element: HTMLIFrameElement;
  /** Replace the child document contents. */
  setContent(html: string): void;
  /** Send a message payload into the child sandbox runtime. */
  postMessage(payload: unknown): void;
  /** Receive payloads sent from the child sandbox runtime. */
  onMessage(handler: (payload: unknown) => void): () => void;
  /** Destroy the sandbox and remove the iframe from the DOM. */
  destroy(): void;
}

export interface SpindleSandboxMediaResource {
  /** Object URL that can be assigned to sandbox-local media elements. */
  url: string;
  /** Response media type without parameters, e.g. `audio/mpeg`. */
  contentType: string;
  /** Downloaded media size in bytes. */
  sizeBytes: number;
  /** Revoke the object URL when it is no longer needed. */
  revoke(): void;
}

export interface SpindleSandboxAudioOptions {
  /** Request options passed to the permission-gated CORS proxy. */
  request?: RequestInitDTO;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** Clamped to the browser audio range `[0, 1]`. */
  volume?: number;
}

export interface SpindleSandboxAudioHandle extends SpindleSandboxMediaResource {
  /** Sandbox-local audio element backed by the fetched blob URL. */
  element: HTMLAudioElement;
  play(): Promise<void>;
  pause(): void;
  /** Pause playback, detach the element, and revoke the object URL. */
  destroy(): void;
}

/** API exposed inside the sandboxed iframe as `window.spindleSandbox`. */
export interface SpindleSandboxAPI {
  postMessage(payload: unknown): void;
  onMessage(handler: (payload: unknown) => void): () => void;
  requestResize(height?: number): void;
  /** Fetch a URL through the extension's CORS proxy. Requires the `cors_proxy` permission. */
  corsProxy(url: string, options?: RequestInitDTO): Promise<unknown>;
  /** Fetch remote audio through the permission-gated proxy and expose it as a blob URL. */
  fetchAudio(url: string, options?: RequestInitDTO): Promise<SpindleSandboxMediaResource>;
  /** Fetch remote audio through the proxy and create a sandbox-local audio element. */
  createAudio(url: string, options?: SpindleSandboxAudioOptions): Promise<SpindleSandboxAudioHandle>;
  /** Fetch a remote web font through the permission-gated proxy and expose it as a blob URL usable in `@font-face src: url(...)`. */
  fetchFont(url: string, options?: RequestInitDTO): Promise<SpindleSandboxMediaResource>;
}

export interface SpindleUploadFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

export interface SpindleMessageTagIntercept {
  extensionId: string;
  tagName: string;
  attrs: Record<string, string>;
  content: string;
  fullMatch: string;
  messageId?: string;
  chatId?: string;
  isUser?: boolean;
  isStreaming?: boolean;
}

export interface SpindleMessageTagInterceptorOptions {
  tagName: string;
  attrs?: Record<string, string>;
  removeFromMessage?: boolean;
}

export interface SpindleMessageWidgetOptions {
  /** Message ID that should host the widget. */
  messageId: string;
  /** Stable extension-defined widget ID, unique within the target message. */
  widgetId: string;
  /** HTML document or fragment rendered inside a host-managed opaque-origin iframe. */
  html: string;
  /** Minimum iframe height in CSS pixels. Default: 40. */
  minHeight?: number;
  /** Maximum iframe height in CSS pixels. Default: 4000. */
  maxHeight?: number;
}

/** Options for `permissions.request()` — displayed in the system confirmation modal. */
export interface PermissionRequestOptions {
  /** Human-readable explanation of why the extension needs these permissions.
   *  Shown to the user in the confirmation modal. */
  reason?: string;
}

// ── Text Editor ──

export interface SpindleTextEditorOptions {
  /** Modal title. Default: "Edit Text" */
  title?: string;
  /** Initial text content. Default: "" */
  value?: string;
  /** Placeholder text. Default: "" */
  placeholder?: string;
  /** Optional caller-owned 1–128 character ASCII token used with `textEditor.close()`. */
  editorRequestId?: string;
  /** For operator-scoped extensions only. */
  userId?: string;
}

export interface SpindleTextEditorResult {
  /** The edited text (or original value if cancelled) */
  text: string;
  /** True if the user dismissed the editor without confirming */
  cancelled: boolean;
}

// ── Context Menu ──

export interface SpindleContextMenuOptions {
  /** Screen position to render the menu at. */
  position: { x: number; y: number };
  /** Menu items. Items with `type: 'divider'` render as visual separators. */
  items: SpindleContextMenuItemDef[];
}

export interface SpindleContextMenuItemDef {
  /** Unique key returned when this item is selected. */
  key: string;
  /** Display label. Ignored for dividers. */
  label: string;
  /** Render as disabled (greyed out, not clickable). */
  disabled?: boolean;
  /** Render in danger/red style. */
  danger?: boolean;
  /** Render with active/highlighted style. */
  active?: boolean;
  /** Set to `'divider'` for a visual separator. Default: `'item'`. */
  type?: "item" | "divider";
}

export interface SpindleContextMenuResult {
  /** The `key` of the selected item, or `null` if the menu was dismissed without selection. */
  selectedKey: string | null;
}

// ── Modal ──

/**
 * Options for `ctx.ui.showModal()`.
 * The host renders a system-themed modal overlay with a header (title + close button).
 * The extension receives an HTMLElement (`root` on the handle) and fully owns the body content.
 */
export interface SpindleModalOptions {
  /** Modal title displayed in the header. */
  title: string;
  /** Optional width override. Default: `420`. Clamped to viewport. */
  width?: number;
  /** Optional max-height override. Default: `520`. Clamped to viewport. */
  maxHeight?: number;
  /**
   * If true, clicking the backdrop does NOT dismiss the modal.
   * The user must use the close button or the extension must call `dismiss()`.
   * Default: `false` (backdrop click dismisses).
   */
  persistent?: boolean;
}

/**
 * Handle returned by `ctx.ui.showModal()`.
 * Provides direct DOM access to the modal body and lifecycle controls.
 *
 * Extensions may have at most **2 stacked modals** open simultaneously
 * (e.g. one primary modal and one nested text editor). Attempting to open
 * a third modal will throw an error.
 */
export interface SpindleModalHandle {
  /** The body container element. The extension fully owns this element's contents. */
  root: HTMLElement;
  /** Unique modal ID assigned by the host. */
  modalId: string;
  /** Programmatically close the modal. */
  dismiss(): void;
  /** Update the header title. */
  setTitle(title: string): void;
  /**
   * Register a callback invoked when the modal is dismissed
   * (by the user, by `dismiss()`, or by extension cleanup).
   * Returns an unsubscribe function.
   */
  onDismiss(handler: () => void): () => void;
}

// ── Confirmation Modal ──

/** Visual variant for confirmation modals. Controls the accent color of the confirm button. */
export type SpindleConfirmVariant = "info" | "warning" | "danger" | "success";

/**
 * Options for `ctx.ui.showConfirm()`.
 * The host renders a system-themed confirmation modal with a message,
 * variant-colored accent, and actionable buttons.
 */
export interface SpindleConfirmOptions {
  /** Modal title displayed in the header. */
  title: string;
  /** Body text explaining what the user is confirming. */
  message: string;
  /**
   * Visual variant that controls the confirm button's accent color.
   * - `'info'` — neutral/blue (default)
   * - `'warning'` — yellow/amber
   * - `'danger'` — red — use for destructive or irreversible actions
   * - `'success'` — green
   */
  variant?: SpindleConfirmVariant;
  /** Label for the confirm (primary) button. Default: `"Confirm"`. */
  confirmLabel?: string;
  /** Label for the cancel (secondary) button. Default: `"Cancel"`. */
  cancelLabel?: string;
}

/**
 * Result returned by `ctx.ui.showConfirm()`.
 */
export interface SpindleConfirmResult {
  /** `true` if the user clicked the confirm button, `false` if they cancelled or dismissed. */
  confirmed: boolean;
}

// ── UI Event Helpers ──

export type SpindleUIDomActionEventType = "click" | "pointerdown" | "pointerup";

export interface SpindleUIKeyboardState {
  /** True when the host believes a virtual keyboard is currently visible. */
  visible: boolean;
  /** Safe bottom inset in CSS pixels that keeps content above the keyboard. */
  insetBottom: number;
  /** Current visual viewport width in CSS pixels. */
  viewportWidth: number;
  /** Current visual viewport height in CSS pixels. */
  viewportHeight: number;
}

export interface SpindleUIDrawerState {
  /** Whether the side drawer is currently visible. */
  open: boolean;
  /** Active drawer tab, if any. */
  tabId: string | null;
}

export interface SpindleUISettingsState {
  /** Whether the settings modal is currently visible. */
  open: boolean;
  /** Active settings view identifier. */
  view: string;
}

export interface SpindleUIDomActionDetail {
  /** Matched action identifier read from the target element. */
  actionId: string;
  /** DOM event type that triggered the callback. */
  eventType: SpindleUIDomActionEventType;
  /** Matched descendant element that carried the action identifier. */
  element: HTMLElement;
  /** Bound extension-owned root used for delegation. */
  root: Element;
  /** Native DOM event from the host document. */
  originalEvent: Event;
}

export interface SpindleUIDomActionBindingOptions {
  /** Attribute used to resolve action IDs. Default: `id`. */
  attribute?: string;
  /** Event types to listen for. Default: `["click"]`. */
  events?: SpindleUIDomActionEventType[];
}

export interface SpindleUIEventsHelper {
  /** Read the current virtual keyboard snapshot. */
  getKeyboardState(): SpindleUIKeyboardState;
  /** Subscribe to keyboard visibility / safe-area changes. */
  onKeyboardChange(handler: (state: SpindleUIKeyboardState) => void): () => void;
  /** Read the current side drawer snapshot. */
  getDrawerState(): SpindleUIDrawerState;
  /** Subscribe to side drawer open/close and tab changes. */
  onDrawerChange(handler: (state: SpindleUIDrawerState) => void): () => void;
  /** Read the current settings modal snapshot. */
  getSettingsState(): SpindleUISettingsState;
  /** Subscribe to settings modal open/close and active-view changes. */
  onSettingsChange(handler: (state: SpindleUISettingsState) => void): () => void;
  /**
   * Delegate action handlers from extension-owned DOM.
   *
   * This is intended for non-sandbox UI where the extension injects or mounts
   * host DOM directly and wants to react to user interaction without wiring
   * global document listeners. By default the helper matches descendant
   * elements by `id`, but `options.attribute` can be used instead.
   */
  bindActionHandlers(
    target: string | Element,
    handlers: Record<string, (detail: SpindleUIDomActionDetail) => void>,
    options?: SpindleUIDomActionBindingOptions,
  ): () => void;
}

// ── Frontend Process Lifecycle ──

/** Controller passed to a frontend process instance spawned by the backend runtime. */
export interface SpindleFrontendProcessContext {
  /** Host-assigned ID unique within the extension runtime. */
  processId: string;
  /** Frontend handler key used when the backend called `spindle.frontendProcesses.spawn()`. */
  kind: string;
  /** Optional extension-defined stable key passed at spawn time. */
  key?: string;
  /** Arbitrary spawn payload provided by the backend. */
  payload: unknown;
  /** Optional backend-side bookkeeping metadata snapshot. */
  metadata?: Record<string, unknown>;
  /** Signal that startup completed successfully. Required for startup watchdogs. */
  ready(): void;
  /** Refresh the host-side heartbeat timer for long-lived loops. */
  heartbeat(): void;
  /** Send a process-scoped message back to the backend runtime. */
  send(payload: unknown): void;
  /** Subscribe to process-scoped messages from the backend runtime. */
  onMessage(handler: (payload: unknown) => void): () => void;
  /** Mark the process as completed and release host tracking. */
  complete(result?: unknown): void;
  /** Mark the process as failed. */
  fail(error: string): void;
  /** Called when the backend requests graceful termination. */
  onStop(handler: (detail: { reason?: string }) => void): () => void;
}

/** Registry exposed to frontend modules for backend-spawned frontend processes. */
export interface SpindleFrontendProcessRegistry {
  /**
   * Register a process handler for the given `kind`.
   *
   * The returned cleanup function unregisters the handler. If the handler
   * itself returns a cleanup function, the host should call it when the
   * process is stopped, replaced, or the extension is unloaded.
   */
  register(
    kind: string,
    handler: (
      process: SpindleFrontendProcessContext,
    ) => void | (() => void) | Promise<void | (() => void)>,
  ): () => void;
}

export interface SpindleDisplayContext {
  chatId?: string;
  characterId?: string;
  personaId?: string;
  isUser: boolean;
  depth: number;
  messageId?: string;
  messageIndex?: number;
  role?: string;
  dynamicMacros?: Record<string, string>;
}

export interface SpindleDisplayResolveResult {
  content: string;
  /** Opaque local state carried from resolveBody to applyScripts with this content, including cache hits. */
  processingState?: string;
  touchedVars?: string[];
  cacheable?: boolean;
}

export interface SpindleDisplayTemplatesResult {
  resolved: Record<string, string>;
  touchedVars?: Record<string, string[]>;
  cacheable?: Record<string, boolean>;
}

export interface SpindleDisplayBodyArgs {
  content: string;
  context: SpindleDisplayContext;
}

export interface SpindleDisplayTemplatesArgs {
  templates: Record<string, string>;
  context: SpindleDisplayContext;
}

export interface SpindleDisplayScriptsArgs {
  content: string;
  /** The processingState returned by resolveBody for this content. Never sent to the backend. */
  processingState?: string;
  scripts: unknown[];
  context: SpindleDisplayContext;
  resolvedFindPatterns?: Record<string, string>;
  resolvedReplacements?: Record<string, string>;
}

/**
 * A frontend display resolver lets an extension take over display-time content
 * resolution in the browser instead of round-tripping to the host backend. The
 * host consults the registered resolver while rendering messages and falls back
 * to its own backend resolution whenever the resolver is absent, reports it is
 * not ready for the chat, throws, or returns `null`.
 */
export interface SpindleDisplayResolver {
  /** Opt into finalization when no display scripts are active. Defaults to false. */
  finalizeWithoutScripts?: boolean;
  ready(chatId: string): boolean;
  resolveBody(args: SpindleDisplayBodyArgs): Promise<SpindleDisplayResolveResult | null>;
  resolveTemplates(args: SpindleDisplayTemplatesArgs): Promise<SpindleDisplayTemplatesResult | null>;
  applyScripts(args: SpindleDisplayScriptsArgs): Promise<SpindleDisplayResolveResult | null>;
}

export interface SpindleDisplayResolverRegistry {
  /** Register this extension's frontend display resolver. */
  registerResolver(resolver: SpindleDisplayResolver): () => void;
  /** Ask the host to invalidate cached display resolutions whose dependencies (a `<scope>:<name>` set) changed. */
  invalidate(touchedVars: string[]): void;
  /** Update the active chat's transient expression display without a backend round trip. */
  setExpression(expression: {
    chatId: string;
    characterId: string;
    label: string;
    imageId: string;
  }): void;
}

export interface SpindleSettingsAPI {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  watch<T>(key: string, listener: (value: T | undefined) => void): () => void;
  readonly core: {
    get<T>(key: string): T | undefined;
    watch<T>(key: string, listener: (value: T) => void): () => void;
    list(): Array<{ key: string; permission: string | null }>;
    isReady(): boolean;
  };
}

export interface SpindleSettingsTabSection {
  readonly key: string;
  readonly titleKey: string;
  readonly titleFallback: string;
  readonly keywords: readonly string[];
}

export interface SpindleSettingsTabOptions {
  /** A shared tab id may belong to core or to another extension. */
  readonly id: string;
  /** Metadata is ignored when a core tab owns this id. */
  readonly title?: string;
  /** Short label for compact layouts. */
  readonly shortName?: string;
  /** Inline SVG string for the tab icon. */
  readonly iconSvg?: string;
  /** Description for search and command palette. */
  readonly description?: string;
  /** Keywords for search indexing. */
  readonly keywords?: readonly string[];
  /** Sub-sections within the settings tab for search indexing and navigation. */
  readonly sections?: readonly SpindleSettingsTabSection[];
  /**
   * Relative tab position: 'top', 'bottom', 'after-display', 'before-chat',
   * 'after-<tabId>', 'before-<tabId>', or any specific tab identifier.
   */
  readonly position?: string;
  /** Body order among registrants sharing a tab. Defaults to 100. */
  readonly order?: number;
}

export interface SpindleSettingsTabHandle {
  readonly registrationId: string;
  readonly tabId: string;
  readonly root: HTMLElement;
  setTitle(title: string): void;
  activate(): void;
  destroy(): void;
  onActivate(callback: () => void): () => void;
}

export interface SpindleStateSelectors {
  get<T = unknown>(selector: string): T;
  subscribe<T = unknown>(selector: string, listener: (value: T) => void): () => void;
}

export interface SpindleResizeController {
  destroy(): void;
}

export interface SpindleGeometryAPI {
  getUiScale(): number;
  toLayoutPx(value: number): number;
  layoutViewportSize(): { width: number; height: number };
  layoutElementRect(element: Element): DOMRect;
  createResizeController(element: Element, listener: (rect: DOMRect) => void): SpindleResizeController;
}

export type SpindleHostSurfaceKind =
  | "drawer_tab"
  | "settings_tab"
  | "command"
  | "route"
  | "modal"
  | "input_bar_action"
  | "ext_command";

export interface SpindleHostSurfaceRef {
  kind: SpindleHostSurfaceKind;
  id: string;
}

export type SpindleHostActionJsonValue =
  | null
  | boolean
  | number
  | string
  | SpindleHostActionJsonValue[]
  | { [key: string]: SpindleHostActionJsonValue };

export type SpindleHostActionParams = Record<string, SpindleHostActionJsonValue>;

export interface SpindleHostSurfaceInfo {
  kind: SpindleHostSurfaceKind;
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  iconName?: string;
  iconSvg?: string;
  scope?: "global" | "chat" | "chat-idle" | "landing" | "character";
  role?: "admin" | "owner";
  owner?: string;
  invocable?: boolean;
}

export interface SpindleHostSurfaceTarget {
  kind: string;
  id: string;
  parentId?: string;
}

export type SpindleHostSurfaceTargetHandler = (target: SpindleHostSurfaceTarget) => void;

export interface SpindleHostSurfaceAPI {
  list(kinds?: readonly SpindleHostSurfaceKind[]): SpindleHostSurfaceInfo[];
  subscribe(listener: (surfaces: SpindleHostSurfaceInfo[]) => void): () => void;
  invoke(ref: SpindleHostSurfaceRef, params?: SpindleHostActionParams): void | Promise<void>;
  registerDeepLinkTarget(
    kind: string,
    id: string,
    handler: SpindleHostSurfaceTargetHandler,
  ): () => void;
}

export interface SpindleComponentOverrideOptions {
  componentId: string;
  render?: (target: HTMLElement, props: Record<string, unknown>) => void | (() => void);
}

export interface SpindleComponentOverrideHandle {
  destroy(): void;
}

export interface SpindleDomDecoratorOptions {
  target: string;
  decorate: (element: Element) => void | (() => void);
}

export interface SpindleDomDecoratorHandle {
  destroy(): void;
}

export interface SpindleMessageActionOptions {
  id: string;
  label: string;
  onClick: (messageId: string) => void;
}

export interface SpindleMessageActionHandle {
  destroy(): void;
}

export interface SpindleFrontendWorldBooksAPI {
  list(options?: { limit?: number; offset?: number }): Promise<{ data: WorldBookDTO[]; total: number }>;
  get(worldBookId: string): Promise<WorldBookDTO | null>;
  create(input: WorldBookCreateDTO): Promise<WorldBookDTO>;
  update(worldBookId: string, input: WorldBookUpdateDTO): Promise<WorldBookDTO>;
  delete(worldBookId: string): Promise<boolean>;
  entries: {
    list(worldBookId: string, options?: { limit?: number; offset?: number }): Promise<{ data: WorldBookEntryDTO[]; total: number }>;
    get(entryId: string): Promise<WorldBookEntryDTO | null>;
    create(worldBookId: string, input: WorldBookEntryCreateDTO): Promise<WorldBookEntryDTO>;
    update(entryId: string, input: WorldBookEntryUpdateDTO): Promise<WorldBookEntryDTO>;
    delete(entryId: string): Promise<boolean>;
  };
  getActivated(chatId: string): Promise<unknown>;
  getGlobal(): Promise<string[]>;
  setGlobal(worldBookIds: string[]): Promise<string[]>;
}

export interface SpindleFrontendTokensAPI {
  countText(text: string, options?: TokenCountOptionsDTO): Promise<TokenCountResultDTO>;
  countMessages(
    messages: Array<Pick<LlmMessageDTO, "role" | "content">>,
    options?: TokenCountOptionsDTO,
  ): Promise<TokenCountResultDTO>;
  countChat(chatId: string, options?: TokenCountOptionsDTO): Promise<TokenCountResultDTO>;
}

export interface SpindleFrontendConnectionsAPI {
  list(): Promise<ConnectionProfileDTO[]>;
  get(connectionId: string): Promise<ConnectionProfileDTO | null>;
  setActiveAcknowledged(connectionId: string | null): void | Promise<void>;
}

export interface SpindleFrontendChatsAPI {
  list(options?: { characterId?: string; limit?: number; offset?: number }): Promise<{ data: ChatDTO[]; total: number }>;
  get(chatId: string): Promise<ChatDTO | null>;
  getActive(): Promise<ChatDTO | null>;
  listRecent?(options?: SpindleRecentChatsQuery): Promise<SpindleRecentChatsPage<SpindleRecentChat>>;
  listRecentGrouped?(options?: SpindleRecentChatsQuery): Promise<SpindleRecentChatsPage<SpindleGroupedRecentChat>>;
  update(chatId: string, input: ChatUpdateDTO): Promise<ChatDTO>;
  delete(chatId: string): Promise<boolean>;
}

export interface SpindleFrontendMessagesAPI {
  get(messageId: string): Promise<ChatMessageDTO | null>;
  list(chatId?: string): Promise<ChatMessageDTO[]>;
  update(chatId: string, messageId: string, input: { content?: string }): Promise<unknown>;
  delete(chatId: string, messageId: string): Promise<void>;
}

/** Query options shared by the Lumiverse recent-chats host reads. */
export interface SpindleRecentChatsQuery {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: "name" | "recent" | "created";
  direction?: "asc" | "desc";
}

/**
 * A flat recent-chat row: one entry per chat, newest-first by default.
 * `message_count` and `last_message_preview` ride along so list UIs never
 * need a per-row message fetch.
 */
export interface SpindleRecentChat {
  id: string;
  character_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  character_name: string;
  character_image_id: string | null;
  character_avatar_path?: string | null;
  message_count: number;
  last_message_preview: string;
  [key: string]: unknown;
}

/**
 * A grouped recent-chat row: one entry per solo character / group member
 * set, pointing at that lineage's most recent chat.
 */
export interface SpindleGroupedRecentChat {
  character_id: string;
  character_name: string;
  character_image_id: string | null;
  character_avatar_path?: string | null;
  latest_chat_id: string;
  latest_chat_name: string;
  updated_at: number;
  chat_count: number;
  is_group: boolean;
  group_character_ids?: string[];
  group_name?: string;
  multiplayer?: boolean;
  [key: string]: unknown;
}

/** Paginated recent-chats response (`data` + `total`). */
export interface SpindleRecentChatsPage<TRow = SpindleRecentChat> {
  data: TRow[];
  total: number;
  [key: string]: unknown;
}

/** Context object provided to frontend extension modules */
export interface SpindleFrontendContext {
  /** Per-document routing identity, available with frontend-session-origin-v1. */
  readonly frontendSessionId?: string;
  /** Immutable host compatibility descriptor for this extension runtime. */
  readonly host: SpindleHostDescriptorV1 & {
    readonly surfaces?: SpindleHostSurfaceAPI;
  };
  /** Synchronous host locale access with removable live-change subscriptions. */
  readonly locale: SpindleHostLocaleAPI;
  /** Native persistent theme authoring. Feature-detect each versioned host capability before use. */
  readonly theme: SpindleThemeAuthoringAPI;
  dom: SpindleDOMHelper;
  events: {
    on(event: string, handler: (payload: unknown, metadata?: import("./runtime-state.js").RuntimeEventMetadataDTO) => void): () => void;
    emit(event: string, payload: unknown): void;
  };
  ui: {
    events: SpindleUIEventsHelper;
    mount(point: SpindleMountPoint): Element;
    registerDrawerTab(options: SpindleDrawerTabOptions): SpindleDrawerTabHandle;
    registerCharacterEditorTab(options: SpindleCharacterEditorTabOptions): SpindleCharacterEditorTabHandle;
    characterEditor: SpindleCharacterEditorHelper;
    registerPresetEditorTab(options: SpindlePresetEditorTabOptions): SpindlePresetEditorTabHandle;
    registerPresetEditorToolbarItem(options: SpindlePresetEditorToolbarItemOptions): SpindlePresetEditorToolbarItemHandle;
    presetEditor: SpindlePresetEditorHelper;
    createFloatWidget(options?: SpindleFloatWidgetOptions): SpindleFloatWidgetHandle;
    requestDockPanel(options: SpindleDockPanelOptions): SpindleDockPanelHandle;
    mountApp(options?: SpindleAppMountOptions): SpindleAppMountHandle;
    registerInputBarAction(options: SpindleInputBarActionOptions): SpindleInputBarActionHandle;
    /** Show a themed context menu at the given position and wait for the user's selection.
     *  Returns the `key` of the selected item, or `null` if the menu was dismissed. */
    showContextMenu(options: SpindleContextMenuOptions): Promise<SpindleContextMenuResult>;
    /**
     * Open a system-themed modal overlay.
     * The host renders the chrome (backdrop, header with title & close button);
     * the extension owns the body via the returned handle's `root` element.
     *
     * **Stack limit:** A maximum of 2 modals may be open per extension at any
     * time (e.g. one primary modal and one nested text editor or confirmation).
     * Exceeding this limit throws an error.
     *
     * @example
     * ```ts
     * const modal = ctx.ui.showModal({ title: 'Nudge History' })
     * modal.root.innerHTML = '<ul><li>Item 1</li></ul>'
     * modal.onDismiss(() => console.log('closed'))
     * ```
     */
    showModal(options: SpindleModalOptions): SpindleModalHandle;
    /**
     * Show a system-themed confirmation modal and wait for the user's response.
     * Returns `{ confirmed: true }` if the user clicks the confirm button,
     * or `{ confirmed: false }` if they cancel or dismiss the modal.
     *
     * The confirm button is styled according to the `variant` option
     * (info, warning, danger, success) to signal intent to the user.
     *
     * Counts toward the **2 stacked modals** limit per extension.
     *
     * @example
     * ```ts
     * const { confirmed } = await ctx.ui.showConfirm({
     *   title: 'Delete History',
     *   message: 'This will permanently erase all nudge history for this character.',
     *   variant: 'danger',
     *   confirmLabel: 'Delete',
     * })
     * if (confirmed) {
     *   ctx.sendToBackend({ type: 'delete_history', characterId })
     * }
     * ```
     */
    showConfirm(options: SpindleConfirmOptions): Promise<SpindleConfirmResult>;
    /** Request a tab move to a specific drawer location. */
    requestTabLocation(tabId: string, location: SpindleTabLocation): void;
    /** Read the current drawer location for a built-in or extension tab. */
    getTabLocation(tabId: string): SpindleTabLocation;
    /** Get the display title of a built-in drawer tab by its id. */
    getBuiltInTabTitle(tabId: string): string | undefined;
    /** Get the root HTMLElement of a built-in drawer tab by its id, or undefined if not mounted. */
    getBuiltInTabRoot(tabId: string): HTMLElement | undefined;
    registerSettingsTab?(options: SpindleSettingsTabOptions): SpindleSettingsTabHandle;
    geometry?: SpindleGeometryAPI;
  };
  /**
   * Mount instances of Lumiverse's first-party shared UI components (form
   * atoms, model picker, select, pagination, etc.) inside extension-owned DOM.
   * The host renders real React components into the supplied container — the
   * extension never needs to depend on React directly. See
   * {@link SpindleComponentsHelper} for the full surface.
   */
  components: SpindleComponentsHelper;
  /** Register or unregister passive DOM containers that can receive tab roots. */
  containers: {
    /** Register a container element with a stable id. Tabs routed to this id via `requestTabLocation` will be reparented into `element`. Idempotent on id collision. */
    registerContainer(entry: { id: string; side: 'left' | 'right' | 'top' | 'bottom'; element: HTMLElement }): void;
    /** Remove a previously registered container. Tabs still pointing to this id will fall back to the main drawer. */
    unregisterContainer(id: string): void;
  };
  uploads: {
    pickFile(options?: {
      accept?: string[];
      multiple?: boolean;
      maxSizeBytes?: number;
    }): Promise<SpindleUploadFile[]>;
  };
  permissions: {
    getGranted(): Promise<string[]>;
    /** Request that the given permissions be granted. Returns the updated granted list.
     *  A system-level confirmation modal is shown to the user before any permissions are applied.
     *  Privileged permissions (e.g. cors_proxy) require admin/owner approval.
     *  Rejects with an error if the user denies the request. */
    request(permissions: string[], options?: PermissionRequestOptions): Promise<string[]>;
  };
  /**
   * Get the currently active chat and character.
   * Returns immediately from the frontend app state — no async, no backend roundtrip.
   * Works reliably on page refresh, extension reload, and initial load.
   *
   * @example
   * ```ts
   * const { chatId, characterId } = ctx.getActiveChat()
   * if (chatId) {
   *   ctx.sendToBackend({ type: 'init', chatId, characterId })
   * }
   * ```
   */
  getActiveChat(): { chatId: string | null; characterId: string | null };
  /**
   * Signal that the frontend is ready to receive any startup messages that
   * were queued while the bundle was loading.
   */
  ready(): void;
  /**
   * Opt out of legacy auto-ready behavior. Call during setup() before it
   * returns if initialization continues asynchronously and startup messages
   * should remain queued until a later `ready()` call.
   */
  deferReady(): void;
  sendToBackend(payload: unknown): void;
  onBackendMessage(handler: (payload: unknown) => void): () => void;
  /** Structured lifecycle hooks for backend-spawned frontend processes. */
  processes: SpindleFrontendProcessRegistry;
  messages: {
    registerTagInterceptor(
      options: SpindleMessageTagInterceptorOptions,
      handler: (payload: SpindleMessageTagIntercept) => void
    ): () => void;
    /** Render or replace a sandboxed widget below a message. Returns a cleanup function. */
    renderWidget(
      options: SpindleMessageWidgetOptions,
      handler?: (payload: unknown) => void,
    ): () => void;
    /** Remove a previously rendered message widget. */
    removeWidget(messageId: string, widgetId: string): void;
    /**
     * Get the latest (most recent) message id in the active chat, or
     * `null` if the chat is empty / no chat is active. Reflects the
     * full chat history — works even when the latest bubble is
     * currently scrolled off-screen (the chat list is virtualized, so
     * the DOM might not contain the bubble even though the message
     * exists logically).
     *
     * Typical use: extensions that decorate or react to the most recent
     * message (trackers, summarizers, "show last response details"
     * widgets) call this on setup + on each new-message event to find
     * the id they should target, then pair with `dom.findMessageElement`
     * or `dom.inject()` to attach DOM content. Injections registered
     * via `dom.inject()` auto-replay when the bubble next mounts so the
     * extension doesn't have to re-attach on scroll itself.
     */
    getLatestMessageId(): string | null;
    /**
     * Get the message id at the given chronological index in the
     * active chat (0 = oldest, length-1 = newest). Negative indices
     * count from the end Python-style: -1 = latest, -2 = second-
     * latest. Returns `null` if the index is out of range or no chat
     * is active.
     */
    getMessageIdAtIndex(index: number): string | null;
    /**
     * Enumerate every message id in the active chat in chronological
     * order (oldest first, newest last). Reflects the full chat
     * history, not just messages currently mounted in the DOM. See
     * `dom.listMessageElements()` for the mounted-only DOM view.
     */
    listMessageIds(): string[];
    get?: SpindleFrontendMessagesAPI["get"];
    list?: SpindleFrontendMessagesAPI["list"];
    update?: SpindleFrontendMessagesAPI["update"];
    delete?: SpindleFrontendMessagesAPI["delete"];
  };
  characters: {
    /** Read a character through the host app's authenticated API. */
    get(characterId: string): Promise<unknown>;
  };
  chats: {
    /** Update a message through the host app's authenticated API. */
    updateMessage(chatId: string, messageId: string, input: { content?: string }): Promise<unknown>;
    list?: SpindleFrontendChatsAPI["list"];
    get?: SpindleFrontendChatsAPI["get"];
    getActive?: SpindleFrontendChatsAPI["getActive"];
    /**
     * Lumiverse host extension: flat one-row-per-chat recent list with
     * server-side search/sort and per-row preview enrichment. Free
     * (session-authenticated REST read). Undefined on hosts without it.
     */
    listRecent?(options?: SpindleRecentChatsQuery): Promise<SpindleRecentChatsPage<SpindleRecentChat>>;
    /**
     * Lumiverse host extension: recent chats grouped per character/group with
     * server-side search, sort, and pagination. Free (session-authenticated
     * REST read). Undefined on hosts without it.
     */
    listRecentGrouped?(options?: SpindleRecentChatsQuery): Promise<SpindleRecentChatsPage<SpindleGroupedRecentChat>>;
    update?: SpindleFrontendChatsAPI["update"];
    delete?: SpindleFrontendChatsAPI["delete"];
  };
  /** Take over display-time content resolution in the browser. */
  display?: SpindleDisplayResolverRegistry;
  manifest: import("./manifest.js").SpindleManifest;
  settings?: SpindleSettingsAPI;
  registerComponentOverride?(
    options: SpindleComponentOverrideOptions,
  ): SpindleComponentOverrideHandle;
  registerDomDecorator?(options: SpindleDomDecoratorOptions): SpindleDomDecoratorHandle;
  registerMessageAction?(options: SpindleMessageActionOptions): SpindleMessageActionHandle;
  onTeardown?(handler: () => void): () => void;
  state?: SpindleStateSelectors;
  worldBooks?: SpindleFrontendWorldBooksAPI;
  tokens?: SpindleFrontendTokensAPI;
  connections?: SpindleFrontendConnectionsAPI;
}

/** Frontend context with V2 extensibility members required. */
export type SpindleFrontendContextV2 = SpindleFrontendContext & {
  settings: SpindleSettingsAPI;
  registerComponentOverride(
    options: SpindleComponentOverrideOptions,
  ): SpindleComponentOverrideHandle;
  registerDomDecorator(options: SpindleDomDecoratorOptions): SpindleDomDecoratorHandle;
  registerMessageAction(options: SpindleMessageActionOptions): SpindleMessageActionHandle;
  onTeardown(handler: () => void): () => void;
  state: SpindleStateSelectors;
  worldBooks: SpindleFrontendWorldBooksAPI;
  tokens: SpindleFrontendTokensAPI;
  connections: SpindleFrontendConnectionsAPI;
  host: SpindleHostDescriptorV1 & { readonly surfaces: SpindleHostSurfaceAPI };
  ui: SpindleFrontendContext["ui"] & {
    registerSettingsTab(options: SpindleSettingsTabOptions): SpindleSettingsTabHandle;
    geometry: SpindleGeometryAPI;
  };
  chats: SpindleFrontendContext["chats"] & SpindleFrontendChatsAPI;
  messages: SpindleFrontendContext["messages"] & SpindleFrontendMessagesAPI;
};

/** Cleanup returned by a frontend extension setup hook. */
export type SpindleFrontendTeardown = () => void | Promise<void>;

/** Metadata for the single widget requested by a native desktop pop-out. */
export interface SpindleFrontendWidgetTarget {
  /** Zero-based position among this extension's visible floating widgets. */
  index: number;
  /** Host-provided display title for the native window. */
  title: string;
  /** Initial widget content width in logical pixels. */
  width: number;
  /** Initial widget content height in logical pixels. */
  height: number;
  /** Whether the extension requested a host window without title chrome. */
  chromeless: boolean;
}

/** What a frontend extension module must export */
export interface SpindleFrontendModule {
  setup(
    ctx: SpindleFrontendContext,
  ): void | SpindleFrontendTeardown | Promise<void | SpindleFrontendTeardown>;
  teardown?(): void | Promise<void>;
}

/** A lightweight native floating-widget frontend module. */
export interface SpindleWidgetFrontendModule {
  setupWidget(
    ctx: SpindleFrontendContext,
    target: SpindleFrontendWidgetTarget,
  ): void | SpindleFrontendTeardown | Promise<void | SpindleFrontendTeardown>;
  teardown?(): void | Promise<void>;
}
