import type { CharacterDTO, ChatDTO, PersonaDTO, WorldBookEntryDTO } from "./api.js";

export interface RuntimeStateRevisionDTO {
  epoch: string;
  sequence: number;
}

export interface RuntimeEventMetadataDTO {
  stateRevision?: RuntimeStateRevisionDTO;
  runtimeMutationId?: string;
}

export type RuntimeCharacterDTO = Omit<CharacterDTO, "extensions">;
export type RuntimeChatDTO = Omit<ChatDTO, "character_id"> & { character_id: string | null };

export interface RuntimeMessageDTO {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  name: string;
  index_in_chat: number;
  created_at: number;
  send_date: number;
  extra: { greeting_index?: unknown };
}

export interface RuntimeStateSnapshotDTO {
  revision: RuntimeStateRevisionDTO;
  chat: RuntimeChatDTO;
  character: RuntimeCharacterDTO;
  persona: PersonaDTO | null;
  messages: RuntimeMessageDTO[];
  lore: WorldBookEntryDTO[];
  globalVariables: unknown;
}

export type RuntimeStateCommandDTO =
  | { kind: "chat.metadata"; key: string; value: unknown }
  | { kind: "chat.variables"; values: Record<string, string | null> }
  | { kind: "message.edit"; id: string; content: string }
  | { kind: "message.delete"; id: string }
  | { kind: "message.create"; id: string; content: string; role: "user" | "assistant" | "system" }
  | { kind: "character.update"; id: string; patch: { name?: string; description?: string; first_mes?: string } }
  | { kind: "persona.update"; id: string; patch: { name?: string; description?: string } }
  | { kind: "lore.create"; bookId: string; patch: Record<string, unknown> }
  | { kind: "lore.update"; id: string; patch: Record<string, unknown> }
  | { kind: "lore.delete"; id: string };

export interface RuntimeStateAcknowledgementDTO {
  revision: RuntimeStateRevisionDTO;
  value: unknown;
  patch: {
    chat?: RuntimeChatDTO;
    character?: RuntimeCharacterDTO;
    persona?: PersonaDTO;
    message?: RuntimeMessageDTO;
    deletedMessageId?: string;
    loreEntry?: WorldBookEntryDTO;
    deletedLoreId?: string;
  };
}

export interface SpindleRuntimeStateAPI {
  /** Requires characters, chats, chat_mutation, personas, and world_books permissions. */
  read(chatId: string, characterId: string, userId?: string): Promise<RuntimeStateSnapshotDTO>;
  /** Mutation IDs correlate events with acknowledgements; they do not provide idempotency. */
  write(chatId: string, command: RuntimeStateCommandDTO, userId?: string, mutationId?: string): Promise<RuntimeStateAcknowledgementDTO>;
}
