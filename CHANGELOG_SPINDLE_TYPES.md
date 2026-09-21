# Lumiverse Spindle Types - Technical Changelog

## 0.6.35
- Added capability-gated document routing, cancellable required generation hooks,
  and runtime state snapshots, mutation acknowledgements, and event metadata.
  Existing message handlers and optional hook registrations remain valid.
- Added optional display processing state and authoritative macro source ownership.

## Unreleased
- Version 0.6.33 adds prompt-local `outputOrder` to world-info interceptor
  entries and mutations, plus the `worldInfoOutputOrdering` host contract.
  Extensions can request insertion order after budget selection or clear an
  earlier request without changing stored lore or selection priority.
- Added the create-only `preset_id` link to `RegexScriptCreateDTO` and the
  host-projected read-only `preset_id` on `RegexScriptDTO`, and excluded the field
  from `RegexScriptUpdateDTO` so an update cannot attempt to re-point a script's
  preset link.
- Added trusted per-user context to host-to-worker `tool_invocation` messages and the
  `TOOL_INVOCATION` handler's second argument, while keeping identity out of the
  model-controlled tool payload and args.

- Added the permission-gated `spindle.mcp` API for redacted user MCP server
  discovery, guarded server creation/connection, and advertised tool calls.
- Added the `mcp_servers` and `mcp_servers.create` privileged permissions and
  the `mcp-servers-v1` host capability.
- Added opt-in `chromeless` and `centerContent` presentation flags to
  `SpindleDockPanelOptions`.
- Declared the runtime-supported `setSize`, `setMinSize`, and `setMaxSize`
  methods on `SpindleDockPanelHandle`.
- Aligned `SpindleHostSurfaceAPI` with the host's ref-based invocation and
  deep-link registration contracts.
- Aligned settings-tab handles and settings storage reads with the concrete
  frontend host implementations.
- Restricted mounted host-surface props and event payloads to the host's
  recursive JSON value contract.

## Release v0.6.22

- Added `spindle.frontendCapabilities.declare()` and the
  `SpindleFrontendRuntimeCapability` contract.
- Added the `message_tag_interceptor` runtime capability so hosts can delay
  initial chat reveal until declared frontend interceptors attach.
- Added worker protocol messages for capability registration/retraction and
  `ExtensionInfo.frontend_runtime_capabilities` bootstrap metadata.
- Advertised host support through `frontend-runtime-capabilities-v1`.

## Release v0.6.20

This release introduces major type definitions and contracts for **Frontend Extensibility V2**, **Provider Runtime & Broker Protocols**, **Host Surface Handles**, **Extended Settings Tab Customization**, and **SDK Packaging & Consumer Verification**.

---

### Table of Contents
1. [Provider Runtime & Driver Hooks](#1-provider-runtime--driver-hooks)
2. [Frontend Extensibility V2 & DOM Enhancements](#2-frontend-extensibility-v2--dom-enhancements)
3. [Component Surface Mounting & Controls](#3-component-surface-mounting--controls)
4. [Permissions & Host Compatibility Capabilities](#4-permissions--host-compatibility-capabilities)
5. [Events & Observability](#5-events--observability)
6. [SDK Distribution, Packaging, & Consumer Verification](#6-sdk-distribution-packaging--consumer-verification)

---

### 1. Provider Runtime & Driver Hooks

Introduced bidirectional worker-to-host and host-to-worker protocols enabling Lumiverse extensions to register custom backend inference, speech, audio, and sidecar providers.

#### New Types & Enums (`src/api.ts`, `src/index.ts`)
- **`ProviderKind`**:
  ```typescript
  export type ProviderKind = "embedding" | "tts" | "stt" | "sidecar";
  ```
- **`ProviderDescriptor`**:
  ```typescript
  export interface ProviderDescriptor {
    id: string;
    kind: ProviderKind;
    name: string;
    version?: string;
    capabilities?: Record<string, unknown>;
  }
  ```
- **`WorkerToHostProviderMessage`**:
  - `{ type: "provider_register", requestId: string, descriptor: ProviderDescriptor }` (payload limit: 64KiB)
  - `{ type: "provider_unregister", requestId: string, providerId: string }`
  - `{ type: "provider_result", requestId: string, result?: unknown, error?: string }` (payload limit: 1MiB)
- **`HostToWorkerProviderMessage`**:
  - `{ type: "provider_invoke", requestId: string, providerId: string, method: string, params?: unknown, timeoutMs?: number }` (payload limit: 256KiB, default timeout: 30000ms)
  - `{ type: "provider_abort", requestId: string, reason?: string }`
  - `{ type: "provider_changed", providerId?: string, change?: "registered" | "unregistered" | "updated" }`
- **`ProviderRuntimeMessage`**: Union of `WorkerToHostProviderMessage | HostToWorkerProviderMessage`.
- **`BrokerRequest` & `BrokerResponse`**: HTTP wire framing contract for sidecar communication with configurable body encodings (`"utf8" | "base64"`).
- **`ProviderManager`**:
  ```typescript
  export interface ProviderManager {
    register(descriptor: ProviderDescriptor): void | Promise<void>;
    list(): ProviderDescriptor[] | Promise<ProviderDescriptor[]>;
    invoke(providerId: string, method: string, params?: unknown): Promise<unknown>;
    revoke(providerId: string): void | Promise<void>;
    reconnect(providerId: string): void | Promise<void>;
    disposeGeneration(generationId: string): void | Promise<void>;
  }
  ```

#### Extension Driver Interfaces (`src/spindle-api.ts`, `src/index.ts`)
- **`SpindleEmbeddingDriver`**: Custom vector embedding engine provider.
  ```typescript
  export interface SpindleEmbeddingDriver {
    id: string;
    name?: string;
    embed(input: { texts: string[] }): Promise<{ embeddings: number[][] }>;
  }
  ```
- **`SpindleTtsEngine`**: Text-to-speech audio synthesis engine.
  ```typescript
  export interface SpindleTtsEngine {
    id: string;
    name?: string;
    synthesize(input: { text: string; voice?: string }): Promise<{ audio: Uint8Array | string; contentType?: string }>;
  }
  ```
- **`SpindleSttEngine`**: Speech-to-text audio transcription engine.
  ```typescript
  export interface SpindleSttEngine {
    id: string;
    name?: string;
    transcribe(input: { audio: Uint8Array | string; contentType?: string }): Promise<{ text: string }>;
  }
  ```
- **`SpindleSidecarEndpoint`**: Sidecar HTTP handler for specialized backend extensions.
  ```typescript
  export interface SpindleSidecarEndpoint {
    id: string;
    path: string;
    handle(request: BrokerRequest): Promise<BrokerResponse>;
  }
  ```
- **`SpindleAPI` Additions**:
  - `providers?: ProviderManager`
  - `registerEmbeddingDriver?(driver: SpindleEmbeddingDriver): () => void`
  - `registerTtsEngine?(engine: SpindleTtsEngine): () => void`
  - `registerSttEngine?(engine: SpindleSttEngine): () => void`
  - `registerSidecarEndpoint?(endpoint: SpindleSidecarEndpoint): () => void`

---

### 2. Frontend Extensibility V2 & DOM Enhancements

Provides rich frontend context and layout interfaces for deep client-side customization.

#### Settings Tab Customization (`src/dom.ts`, `src/index.ts`)
- **`SpindleSettingsTabSection`**:
  ```typescript
  export interface SpindleSettingsTabSection {
    readonly key: string;
    readonly titleKey: string;
    readonly titleFallback: string;
    readonly keywords?: readonly string[];
  }
  ```
- **`SpindleSettingsTabOptions`**:
  ```typescript
  export interface SpindleSettingsTabOptions {
    id: string;
    title: string;
    shortName?: string;
    iconSvg?: string;
    description?: string;
    keywords?: readonly string[];
    sections?: readonly SpindleSettingsTabSection[];
    position?: 'top' | 'bottom' | `after-${string}` | `before-${string}` | string;
    order?: number;
    render?: (root: HTMLElement) => void | (() => void);
  }
  ```
- **`SpindleSettingsTabHandle`**: Handle allowing live options updates and clean destruction.

#### UI Geometry, Component Overrides, & State Subscriptions (`src/dom.ts`, `src/index.ts`)
- **`SpindleGeometryAPI` & `SpindleResizeController`**: High precision layout viewport measurements and element resize subscriptions with DPI scale compensation (`getUiScale()`, `toLayoutPx()`, `layoutViewportSize()`, `layoutElementRect()`, `createResizeController()`).
- **`SpindleStateSelectors`**: Reactive state access (`get()`, `subscribe()`).
- **`SpindleComponentOverrideOptions` & `SpindleComponentOverrideHandle`**: Extension takeover of internal component render pipelines.
- **`SpindleDomDecoratorOptions` & `SpindleDomDecoratorHandle`**: Targeted element decoration hooks.
- **`SpindleMessageActionOptions` & `SpindleMessageActionHandle`**: Custom contextual actions attached to chat messages.

#### Domain Frontends (`src/dom.ts`, `src/index.ts`)
- **`SpindleFrontendWorldBooksAPI`**: Complete frontend WorldBook and entry CRUD operations, active chat queries, and global worldbook binding.
- **`SpindleFrontendTokensAPI`**: Client-side token estimation (`countText`, `countMessages`, `countChat`).
- **`SpindleFrontendConnectionsAPI`**: Connection profile retrieval and active profile acknowledgment.
- **`SpindleFrontendChatsAPI` & `SpindleFrontendMessagesAPI`**: Complete frontend chat & message lifecycle management.

#### Frontend Context Types
- **`SpindleFrontendContext`**: Enriched with optional V2 APIs for backwards-compatible host detection.
- **`SpindleFrontendContextV2`**: Strict context type guaranteeing presence of all V2 modules when running in an environment with `"frontend-extensibility-v2"` capability.

---

### 3. Component Surface Mounting & Controls

#### Named Host Surfaces (`src/components.ts`, `src/index.ts`)
- **`SpindleHostSurfaceHandle`**:
  ```typescript
  export interface SpindleHostSurfaceHandle {
    update(props?: Record<string, unknown>): void;
    destroy(): void;
    on(event: string, handler: (payload: unknown) => void): () => void;
  }
  ```
- **`SpindleComponentsHelper.mountHostSurface`**: Mounts host-owned UI surfaces inside extension containers.

---

### 4. Permissions & Host Compatibility Capabilities

#### Host Capability Constants (`src/host.ts`)
- Added `"frontend-extensibility-v2": 1` to `SPINDLE_HOST_CAPABILITIES`.

#### Permissions (`src/permissions.ts`)
- Added provider registration permissions to `SpindlePermission` and `ALL_PERMISSIONS`:
  - `"providers.embedding.register"`
  - `"providers.tts.register"`
  - `"providers.stt.register"`
  - `"providers.sidecar.register"`

---

### 5. Events & Observability

#### Core Event Types (`src/events.ts`)
- Added `CoreEventType.PROVIDER_CHANGED = "PROVIDER_CHANGED"`.

---

### 6. SDK Distribution, Packaging, & Consumer Verification

#### Build & Verification Suite (`test/`, `package.json`, `tsconfig.json`)
- Pinned TypeScript compiler version `5.6.3`.
- Emits pre-compiled declarations (`dist/*.d.ts`) and runtime artifacts (`dist/*.js`) into package distribution.
- Automated packing & consumer integration test script (`test/scripts/verify-packed-consumer.mjs`) ensuring clean npm package tarball creation, isolated consumer resolution, and declaration typing compliance.
- Expanded consumer test suite covering legacy 0.6.15 consumer assignability, packed 0.6.16+ consumer imports, provider runtime union parity, and theme authoring contracts.
