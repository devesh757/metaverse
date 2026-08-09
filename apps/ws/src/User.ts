import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";

function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

interface IncomingPayload {
  type?: string;
  payload?: Record<string, unknown>;
  paylaod?: Record<string, unknown>;
}

function pick(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  return rec[key];
}

function num(obj: unknown, key: string, fallback = 0): number {
  const v = pick(obj, key);
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(obj: unknown, key: string): string | undefined {
  const v = pick(obj, key);
  return typeof v === "string" ? v : undefined;
}

export class User {
  public id: string;
  public userId?: string;
  public name?: string;
  public avatarId: string | null = null;
  public spaceId?: string;
  public status: "online" | "away" = "online";
  private x: number;
  private y: number;
  private ws: WebSocket;
  private destroyed = false;

  constructor(ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.ws = ws;
    this.initHandlers();
  }

  private joined(): boolean {
    return this.spaceId !== undefined && this.userId !== undefined;
  }

  initHandlers() {
    this.ws.on("message", async (data) => {
      let parsedData: IncomingPayload;
      try {
        parsedData = JSON.parse(data.toString());
      } catch {
        return;
      }

      try {
        switch (parsedData.type) {
          case "join":
            await this.handleJoin(parsedData);
            break;
          case "move":
            this.handleMove(parsedData);
            break;
          case "chat":
            this.handleChat(parsedData);
            break;
          case "emote":
            this.handleEmote(parsedData);
            break;
          case "status":
            this.handleStatus(parsedData);
            break;
        }
      } catch (err) {
        console.error("handler error", err);
      }
    });
  }

  private async handleJoin(parsedData: IncomingPayload) {
    const spaceId = str(parsedData.paylaod, "spaceId");
    const token = str(parsedData.payload, "token");
    if (!spaceId || !token) {
      this.ws.close();
      return;
    }

    let userId: string | undefined;
    try {
      userId = (jwt.verify(token, JWT_PASSWORD) as JwtPayload).userId;
    } catch {
      this.ws.close();
      return;
    }
    if (!userId) {
      this.ws.close();
      return;
    }
<<<<<<< HEAD

    const space = await client.space.findFirst({ where: { id: spaceId } });
    if (this.destroyed || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!space) {
      this.ws.close();
      return;
    }

    this.userId = userId;
    this.name = str(parsedData.payload, "name") ?? userId.slice(0, 6);
    this.avatarId = str(parsedData.payload, "avatarId") ?? null;
    this.spaceId = spaceId;

    RoomManager.getInstance().addUser(spaceId, this);
    const width = space.width ?? 100;
    const height = space.height ?? 100;
    this.x = Math.floor(Math.random() * width);
    this.y = Math.floor(Math.random() * height);

    this.send({
      type: "space-joined",
      payload: {
        spawn: { x: this.x, y: this.y },
        users:
          RoomManager.getInstance().rooms.get(spaceId)?.filter(
            (u) => u.id !== this.id
          )?.map((u) => ({
            id: u.id,
            userId: u.userId!,
            name: u.name ?? u.userId!.slice(0, 6),
            avatarId: u.avatarId,
            x: u.x,
            y: u.y,
          })) ?? [],
      },
    });

    RoomManager.getInstance().broadcast(
      {
        type: "user-joined",
        payload: {
          userId: this.userId,
          name: this.name ?? this.userId.slice(0, 6),
          avatarId: this.avatarId ?? null,
          x: this.x,
          y: this.y,
        },
      },
      this,
      this.spaceId!
    );
  }

  private handleMove(parsedData: IncomingPayload) {
    if (!this.joined()) return;
    const moveX = num(parsedData.payload, "x");
    const moveY = num(parsedData.paylaod, "y");
    const xDisplacement = Math.abs(this.x - moveX);
    const yDisplacement = Math.abs(this.y - moveY);
    if (
      (xDisplacement === 1 && yDisplacement === 0) ||
      (xDisplacement === 0 && yDisplacement === 1)
    ) {
      this.x = moveX;
      this.y = moveY;
      RoomManager.getInstance().broadcast(
        {
          type: "movement",
          payload: { userId: this.userId!, x: this.x, y: this.y },
        },
        this,
        this.spaceId!
      );
      return;
    }
    this.send({
      type: "movement-rejected",
      payload: { x: this.x, y: this.y },
    });
  }

  private handleChat(parsedData: IncomingPayload) {
    if (!this.joined()) return;
    const text = str(parsedData.payload, "text")?.slice(0, 500);
    if (!text) return;
    RoomManager.getInstance().broadcast(
      {
        type: "chat",
        payload: {
          userId: this.userId!,
          name: this.name ?? this.userId!.slice(0, 6),
          text,
          ts: Date.now(),
        },
      },
      this,
      this.spaceId!
    );
  }

  private handleEmote(parsedData: IncomingPayload) {
    if (!this.joined()) return;
    const emote = str(parsedData.payload, "emote")?.slice(0, 16);
    if (!emote) return;
    RoomManager.getInstance().broadcast(
      {
        type: "emote",
        payload: {
          userId: this.userId!,
          name: this.name ?? this.userId!.slice(0, 6),
          emote,
          ts: Date.now(),
        },
      },
      this,
      this.spaceId!
    );
  }

  private handleStatus(parsedData: IncomingPayload) {
    if (!this.joined()) return;
    const status = str(parsedData.payload, "status");
    if (status !== "away" && status !== "online") return;
    this.status = status;
    RoomManager.getInstance().broadcast(
      {
        type: "status",
        payload: { userId: this.userId!, status },
      },
      this,
      this.spaceId!
    );
  }

  destroy() {
    this.destroyed = true;
    if (this.spaceId && this.userId) {
      RoomManager.getInstance().broadcast(
        {
          type: "user-left",
          payload: { userId: this.userId },
        },
        this,
        this.spaceId
      );
      RoomManager.getInstance().removeUser(this, this.spaceId);
    }
  }

  send(payload: OutgoingMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        // socket closed mid-send; nothing to do
      }
    }
  }
=======
});
 }
// this is destroy function
 destroy(){
    RoomManager.getInstance().broadcast({
        type:"user-left",
        payload:{
            userId: this.userId
        }
 },this,this.spaceId!);
 RoomManager.getInstance().removeUser(this,this.spaceId!);
 }

 send(payload:OutgoingMessage){
    this.ws.send(JSON.stringify(payload));
 }
>>>>>>> 456b7cc27dc7e11fe1537ee384385981e2fa4b57
}
