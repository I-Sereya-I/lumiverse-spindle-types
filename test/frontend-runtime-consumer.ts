import type {
  SpindleAPI, SpindleFrontendContext, WorkerToHost, HostToWorker,
  RuntimeStateCommandDTO, RuntimeEventMetadataDTO,
} from "lumiverse-spindle-types";

declare const api: SpindleAPI;
declare const frontend: SpindleFrontendContext;

api.registerContextHandler(async (context, signal) => {
  signal?.throwIfAborted();
  return context;
}, 100, { required: true, timeoutMs: 30_000 });
api.registerInterceptor(async (messages, context) => {
  const documentId: string | undefined = context.frontendSessionId;
  api.sendToFrontend({ documentId }, context.userId, { frontendSessionId: documentId });
  return messages;
}, { required: true });
api.registerInterceptor(async messages => messages, 100, { required: true });
api.onFrontendMessage((payload, userId, frontendSessionId) => {
  api.sendToFrontend(payload, userId, { frontendSessionId });
});

frontend.events.on("MESSAGE_EDITED", (_payload, metadata) => {
  const revision: RuntimeEventMetadataDTO["stateRevision"] = metadata?.stateRevision;
  void revision;
});
const documentId: string | undefined = frontend.frontendSessionId;
const commands: RuntimeStateCommandDTO[] = [
  { kind: "chat.metadata", key: "example", value: true },
  { kind: "chat.variables", values: { example: null } },
  { kind: "message.create", id: "uuid", content: "Text", role: "system" },
  { kind: "message.edit", id: "uuid", content: "Changed" },
  { kind: "message.delete", id: "uuid" },
  { kind: "character.update", id: "character", patch: { first_mes: "Greeting" } },
  { kind: "persona.update", id: "persona", patch: { name: "Name" } },
  { kind: "lore.create", bookId: "book", patch: { content: "Lore" } },
  { kind: "lore.update", id: "entry", patch: { disabled: true } },
  { kind: "lore.delete", id: "entry" },
];
async function state() {
  const snapshot = await api.runtimeState.read("chat", "character", "owner");
  const role: "system" | "user" | "assistant" = snapshot.messages[0].role;
  const result = await api.runtimeState.write("chat", commands[0], "owner", "mutation");
  const epoch: string = result.revision.epoch;
  // @ts-expect-error Runtime character projections omit the large extension payload.
  snapshot.character.extensions;
  // @ts-expect-error Unknown operations must not enter the wire protocol.
  await api.runtimeState.write("chat", { kind: "unknown" });
  // @ts-expect-error Message roles match the host's accepted values.
  await api.runtimeState.write("chat", { kind: "message.create", id: "uuid", content: "Text", role: "invalid" });
  return { role, epoch };
}
const worker: WorkerToHost[] = [
  { type: "register_context_handler", required: true },
  { type: "register_interceptor", registrationId: "hook", required: true },
  { type: "context_handler_result", requestId: "request", context: null, error: "" },
  { type: "runtime_state_read", requestId: "request", chatId: "chat", characterId: "character" },
  { type: "runtime_state_write", requestId: "request", chatId: "chat", command: commands[0], mutationId: "mutation" },
  { type: "frontend_message", payload: {}, userId: "owner", frontendSessionId: documentId },
];
const host: HostToWorker[] = [
  { type: "context_handler_abort", requestId: "request", reason: "Stopped" },
  { type: "frontend_message", payload: {}, userId: "owner", frontendSessionId: documentId },
];
void [state, worker, host];

frontend.display?.registerResolver({
  finalizeWithoutScripts: true,
  ready: () => true,
  resolveBody: async ({ content }) => ({ content, processingState: content }),
  resolveTemplates: async ({ templates }) => ({ resolved: templates }),
  applyScripts: async ({ content, processingState }) => {
    const state: string | undefined = processingState;
    return { content: state === content ? content : `changed:${content}` };
  },
});
