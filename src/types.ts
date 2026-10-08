// Shared event contracts: server and client agree on names + payloads.
export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  sentAt: number; // epoch ms
}

export interface ClientToServerEvents {
  "chat:send": (text: string) => void;
}

export interface ServerToClientEvents {
  "chat:message": (msg: ChatMessage) => void;
}
