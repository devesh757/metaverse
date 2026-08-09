export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  ts: number;
}

export interface EmoteMessage {
  userId: string;
  name: string;
  emote: string;
  ts: number;
}

export interface SeedPlayer {
  id: string;
  userId: string;
  name: string;
  avatarId: string | null;
  x: number;
  y: number;
}

export type InboundMessage =
  | {
      type: "space-joined";
      payload: { spawn: { x: number; y: number }; users: SeedPlayer[] };
    }
  | {
      type: "user-joined";
      payload: {
        userId: string;
        name: string;
        avatarId: string | null;
        x: number;
        y: number;
      };
    }
  | { type: "movement"; payload: { userId?: string; x: number; y: number } }
  | { type: "movement-rejected"; payload: { x: number; y: number } }
  | { type: "user-left"; payload: { userId: string } }
  | { type: "chat"; payload: ChatMessage }
  | { type: "emote"; payload: EmoteMessage }
  | {
      type: "status";
      payload: { userId: string; status: "online" | "away" };
    };

export type MessageHandler = (msg: InboundMessage) => void;

type RecordOf<T> = Record<string, T>;

/**
 * The backend (apps/ws) reads `spaceId` from the misspelled `paylaod` key
 * and the `y` coordinate from `paylaod` too. This client tolerates both
 * spellings so it keeps working if the typo is fixed later.
 */
function val(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as RecordOf<unknown>;
  for (const k of keys) {
    if (k in rec) return rec[k];
  }
  return undefined;
}

function pick(obj: unknown, ...keys: string[]): RecordOf<unknown> {
  const rec = val(obj) as RecordOf<unknown> | undefined;
  return rec ?? {};
}

function num(obj: unknown, ...keys: string[]): number {
  const v = val(obj, ...keys);
  return typeof v === "number" ? v : 0;
}

function str(obj: unknown, ...keys: string[]): string | undefined {
  const v = val(obj, ...keys);
  return typeof v === "string" ? v : undefined;
}

export class NexusSocket {
  private ws: WebSocket | null = null;
  private handler: MessageHandler | null = null;
  url: string;

  constructor(url = "ws://localhost:3001") {
    this.url = url;
  }

  connect(
    token: string,
    spaceId: string,
    extra: { name?: string; avatarId?: string } = {}
  ) {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          type: "join",
          payload: {
            token,
            name: extra.name,
            avatarId: extra.avatarId,
          },
          paylaod: { spaceId },
        })
      );
    };
    this.ws.onmessage = (event) => this.dispatch(event.data);
  }

  move(x: number, y: number) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: "move",
        payload: { x },
        paylaod: { y },
      })
    );
  }

  sendChat(text: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "chat", payload: { text } }));
  }

  sendEmote(emote: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "emote", payload: { emote } }));
  }

  sendStatus(status: "online" | "away") {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "status", payload: { status } }));
  }

  close() {
    if (!this.ws) return;
    const ws = this.ws;
    // Closing a CONNECTING socket logs "closed before connection established".
    // Wait for the handshake, then close cleanly.
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener(
        "open",
        () => ws.close(),
        { once: true }
      );
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    this.ws = null;
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  private dispatch(raw: unknown) {
    if (!this.handler) return;
    let data: unknown = raw;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }

    const type = str(data, "type");
    if (!type) return;

    const p = pick(data, "payload", "paylaod");
    const payloadAny = val(data, "payload") ?? val(data, "paylaod");

    switch (type) {
      case "space-joined": {
        const spawn = pick(payloadAny, "spawn");
        const usersRaw = (payloadAny as RecordOf<unknown>)?.users;
        const users: SeedPlayer[] = Array.isArray(usersRaw)
          ? (usersRaw as SeedPlayer[])
          : [];
        this.handler({
          type: "space-joined",
          payload: {
            spawn: {
              x: num(spawn, "x"),
              y: num(spawn, "y"),
            },
            users,
          },
        });
        return;
      }
      case "user-joined":
        this.handler({
          type: "user-joined",
          payload: {
            userId: str(payloadAny, "userId") ?? "",
            name: str(payloadAny, "name") ?? "explorer",
            avatarId: str(payloadAny, "avatarId") ?? null,
            x: num(payloadAny, "x"),
            y: num(payloadAny, "y"),
          },
        });
        return;
      case "movement":
        this.handler({
          type: "movement",
          payload: {
            userId: str(payloadAny, "userId"),
            x: num(p, "x"),
            y: num(p, "y"),
          },
        });
        return;
      case "movement-rejected":
        this.handler({
          type: "movement-rejected",
          payload: {
            x: num(p, "x"),
            y: num(p, "y"),
          },
        });
        return;
      case "user-left":
        this.handler({
          type: "user-left",
          payload: {
            userId: str(payloadAny, "userId") ?? "",
          },
        });
        return;
      case "chat":
        this.handler({
          type: "chat",
          payload: {
            userId: str(payloadAny, "userId") ?? "",
            name: str(payloadAny, "name") ?? "explorer",
            text: str(payloadAny, "text") ?? "",
            ts: (payloadAny as RecordOf<unknown>)?.ts as number,
          },
        });
        return;
      case "emote":
        this.handler({
          type: "emote",
          payload: {
            userId: str(payloadAny, "userId") ?? "",
            name: str(payloadAny, "name") ?? "explorer",
            emote: str(payloadAny, "emote") ?? "✨",
            ts: (payloadAny as RecordOf<unknown>)?.ts as number,
          },
        });
        return;
      case "status":
        this.handler({
          type: "status",
          payload: {
            userId: str(payloadAny, "userId") ?? "",
            status:
              str(payloadAny, "status") === "away" ? "away" : "online",
          },
        });
        return;
    }
  }
}
