"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { NexusSocket } from "@/lib/ws";
import type { Element, SpaceDetail } from "@/lib/types";

export interface Telemetry {
  x: number;
  y: number;
  online: number;
  connected: boolean;
  away: boolean;
}

export interface GameApi {
  sendChat: (text: string) => void;
  sendEmote: (emote: string) => void;
}

export interface PresenceEvent {
  type: "join" | "leave";
  userId: string;
  name: string;
}

interface GameCanvasProps {
  space: SpaceDetail;
  myUserId: string;
  myName: string;
  myAvatarUrl: string | null;
  token: string;
  onTelemetry: (t: Telemetry) => void;
  editMode: boolean;
  selectedElement: Element | null;
  onPlaceElement: (x: number, y: number) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  apiRef: RefObject<GameApi | null>;
  onPresence: (p: PresenceEvent) => void;
  onChatMessage: (m: { userId: string; name: string; text: string; ts: number }) => void;
  onStatus?: (userId: string, status: "online" | "away") => void;
  onInitialPlayers?: (players: { userId: string; name: string }[]) => void;
}

const TILE = 64;
const MOVE_INTERVAL_MS = 60;
const PLAYER_RADIUS = 13;
const IDLE_AFTER_MS = 60000;
const AWAY_CHECK_MS = 5000;

interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  name: string;
  avatarUrl: string | null;
  status: "online" | "away";
  emote: { text: string; ts: number } | null;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return h;
}

function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

const FALLBACK_COLORS = [
  { bg: "rgba(124,92,255,0.35)", edge: "rgba(167,139,250,0.9)" },
  { bg: "rgba(34,211,238,0.3)", edge: "rgba(103,232,249,0.9)" },
  { bg: "rgba(52,245,197,0.28)", edge: "rgba(110,255,220,0.9)" },
  { bg: "rgba(251,146,60,0.3)", edge: "rgba(253,186,116,0.9)" },
];

export default function GameCanvas({
  space,
  myUserId,
  myName,
  myAvatarUrl,
  token,
  onTelemetry,
  editMode,
  selectedElement,
  onPlaceElement,
  canvasRef,
  apiRef,
  onPresence,
  onChatMessage,
  onStatus,
  onInitialPlayers,
}: GameCanvasProps) {
  const propsRef = useRef({
    space,
    editMode,
    selectedElement,
    onPlaceElement,
    onPresence,
    onChatMessage,
    onStatus,
    onInitialPlayers,
  });
  propsRef.current = {
    space,
    editMode,
    selectedElement,
    onPlaceElement,
    onPresence,
    onChatMessage,
    onStatus,
    onInitialPlayers,
  };

  const engineRef = useRef<GameEngine | null>(null);
  const telemetryRef = useRef(onTelemetry);
  telemetryRef.current = onTelemetry;
  const apiRefHolder = apiRef;
  const lastInputRef = useRef(Date.now());

  const spaceId =
    typeof window !== "undefined"
      ? (window.location.pathname.split("/").pop() ?? "")
      : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const [width, height] = propsRef.current.space.dimensions
      .split("x")
      .map(Number);
    const engine = new GameEngine(
      canvas,
      width,
      height,
      myName,
      hashHue(myUserId)
    );
    engine.setElements(propsRef.current.space.elements);
    engine.setSelfAvatar(myAvatarUrl);
    engine.onPlace = (x, y) => propsRef.current.onPlaceElement(x, y);
    engineRef.current = engine;

    const socket = new NexusSocket();
    const nameById = new Map<string, string>();

    socket.onMessage((msg) => {
      switch (msg.type) {
        case "space-joined":
          engine.setSelf(msg.payload.spawn.x, msg.payload.spawn.y);
          engine.setConnected(true);
          for (const u of msg.payload.users) {
            engine.addRemote(u.userId, u.name, u.avatarId, u.x, u.y);
          }
          propsRef.current.onInitialPlayers?.(
            msg.payload.users.map((u) => ({
              userId: u.userId,
              name: u.name,
            }))
          );
          break;
        case "user-joined":
          nameById.set(msg.payload.userId, msg.payload.name);
          engine.addRemote(
            msg.payload.userId,
            msg.payload.name,
            msg.payload.avatarId,
            msg.payload.x,
            msg.payload.y
          );
          propsRef.current.onPresence({
            type: "join",
            userId: msg.payload.userId,
            name: msg.payload.name,
          });
          break;
        case "movement":
          engine.moveRemote(msg.payload.userId, msg.payload.x, msg.payload.y);
          break;
        case "movement-rejected":
          engine.rejectMove(msg.payload.x, msg.payload.y);
          break;
        case "user-left":
          engine.removeRemote(msg.payload.userId);
          propsRef.current.onPresence({
            type: "leave",
            userId: msg.payload.userId,
            name: nameById.get(msg.payload.userId) ?? "someone",
          });
          nameById.delete(msg.payload.userId);
          break;
        case "chat":
          propsRef.current.onChatMessage(msg.payload);
          break;
        case "emote":
          engine.showEmote(msg.payload.userId, msg.payload.emote);
          break;
        case "status":
          engine.setRemoteStatus(msg.payload.userId, msg.payload.status);
          propsRef.current.onStatus?.(msg.payload.userId, msg.payload.status);
          break;
      }
    });
    engine.onSendMove = (x, y) => socket.move(x, y);
    socket.connect(token, spaceId, { name: myName, avatarId: myAvatarUrl ?? undefined });
    apiRefHolder.current = {
      sendChat: (text) => socket.sendChat(text),
      sendEmote: (emote) => socket.sendEmote(emote),
    };

    const idleInterval = window.setInterval(() => {
      const idle = Date.now() - lastInputRef.current;
      const away = idle > IDLE_AFTER_MS;
      if (away !== engine.away) {
        engine.away = away;
        socket.sendStatus(away ? "away" : "online");
      }
    }, AWAY_CHECK_MS);

    engine.startLoop(() => {
      telemetryRef.current({
        x: Math.round(engine.self.x),
        y: Math.round(engine.self.y),
        online: engine.onlineCount(),
        connected: engine.connected,
        away: engine.away,
      });
    });

    return () => {
      window.clearInterval(idleInterval);
      socket.close();
      engine.destroy();
      engineRef.current = null;
      apiRefHolder.current = null;
    };
  }, [canvasRef, myUserId, myName, myAvatarUrl, token, spaceId, apiRefHolder]);

  useEffect(() => {
    engineRef.current?.setElements(space.elements);
  }, [space]);

  useEffect(() => {
    engineRef.current?.setEditState(editMode, selectedElement);
  }, [editMode, selectedElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      engineRef.current?.zoomAt(e.clientX, e.clientY, -e.deltaY * 0.002);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      lastInputRef.current = Date.now();
      const key = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      ) {
        e.preventDefault();
      }
      engineRef.current?.pressKey(key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      lastInputRef.current = Date.now();
      engineRef.current?.releaseKey(e.key.toLowerCase());
    };
    const onPointerDown = (e: PointerEvent) => {
      lastInputRef.current = Date.now();
      const rect = canvas.getBoundingClientRect();
      engineRef.current?.pointerDown(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    };
    const onBlur = () => engineRef.current?.releaseAll();

    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("blur", onBlur);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      style={editMode ? { cursor: "crosshair" } : { cursor: "default" }}
    />
  );
}

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private worldW: number;
  private worldH: number;
  private myName: string;
  private myColor: string;
  private elements: SpaceDetail["elements"] = [];

  self = { x: 50, y: 50 };
  away = false;
  private displayX = 50;
  private displayY = 50;
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1;
  private remote = new Map<string, RemotePlayer>();
  connected = false;
  private telemetryCb: (() => void) | null = null;
  private raf = 0;
  private keys = new Set<string>();
  private moveTimer: number | null = null;
  private lastMoveX = 0;
  private lastMoveY = 0;
  private particles: Particle[] = [];
  private images = new Map<string, HTMLImageElement | "failed">();
  private selfAvatarUrl: string | null = null;
  private selfAvatarImg: HTMLImageElement | "failed" | null = null;
  private editMode = false;
  private selectedElement: Element | null = null;
  private ghostStatic = false;
  onPlace: ((x: number, y: number) => void) | null = null;
  onSendMove: ((x: number, y: number) => void) | null = null;
  private lastTick = 0;
  private time = 0;

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    myName: string,
    myColor: number
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.worldW = Math.max(1, width);
    this.worldH = Math.max(1, height);
    this.myName = myName;
    this.myColor = `hsl(${myColor} 85% 65%)`;
    this.self = { x: Math.floor(this.worldW / 2), y: Math.floor(this.worldH / 2) };
    this.particles = Array.from({ length: 42 }, () => ({
      x: Math.random() * this.worldW,
      y: Math.random() * this.worldH,
      r: Math.random() * 2.2 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.35 + 0.08,
    }));
  }

  setElements(elements: SpaceDetail["elements"]) {
    this.elements = elements;
  }

  setEditState(edit: boolean, element: Element | null) {
    this.editMode = edit;
    this.selectedElement = element;
  }

  setSelfAvatar(url: string | null) {
    this.selfAvatarUrl = url;
    if (!url) {
      this.selfAvatarImg = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => (this.selfAvatarImg = img);
    img.onerror = () => (this.selfAvatarImg = "failed");
    img.src = url;
  }

  setSelf(x: number, y: number) {
    this.self.x = x;
    this.self.y = y;
    this.displayX = x;
    this.displayY = y;
  }

  setConnected(v: boolean) {
    this.connected = v;
  }

  onlineCount() {
    return this.remote.size + (this.connected ? 1 : 0);
  }

  addRemote(
    id: string,
    name: string,
    avatarUrl: string | null,
    x: number,
    y: number
  ) {
    this.remote.set(id, {
      id,
      x,
      y,
      targetX: x,
      targetY: y,
      name,
      avatarUrl,
      status: "online",
      emote: null,
    });
    if (avatarUrl && isValidImageUrl(avatarUrl) && !this.images.has(avatarUrl)) {
      this.loadAvatar(avatarUrl);
    }
  }

  private loadAvatar(url: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    this.images.set(url, "failed");
    img.onload = () => this.images.set(url, img);
    img.onerror = () => this.images.set(url, "failed");
    img.src = url;
  }

  moveRemote(userId: string | undefined, x: number, y: number) {
    if (userId) {
      const p = this.remote.get(userId);
      if (p) {
        p.targetX = x;
        p.targetY = y;
      }
      return;
    }
    for (const p of this.remote.values()) {
      p.targetX = x;
      p.targetY = y;
    }
  }

  rejectMove(x: number, y: number) {
    this.self.x = x;
    this.self.y = y;
  }

  removeRemote(id: string) {
    this.remote.delete(id);
  }

  showEmote(userId: string, emote: string) {
    const p = this.remote.get(userId);
    if (p) p.emote = { text: emote, ts: performance.now() };
  }

  setRemoteStatus(userId: string, status: "online" | "away") {
    const p = this.remote.get(userId);
    if (p) p.status = status;
  }

  startLoop(cb: () => void) {
    this.telemetryCb = cb;
    this.lastTick = performance.now();
    const loop = (now: number) => {
      this.tick(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.moveTimer !== null) {
      clearInterval(this.moveTimer);
      this.moveTimer = null;
    }
  }

  pressKey(key: string) {
    const k = this.normKey(key);
    if (k) {
      const first = !this.keys.has(k);
      this.keys.add(k);
      if (first) this.stepMove();
      if (this.moveTimer === null) {
        this.moveTimer = window.setInterval(
          () => this.stepMove(),
          MOVE_INTERVAL_MS
        );
      }
      return;
    }
    if (key === "e") this.ghostStatic = !this.ghostStatic;
  }

  releaseKey(key: string) {
    const k = this.normKey(key);
    if (k) this.keys.delete(k);
  }

  releaseAll() {
    this.keys.clear();
  }

  private normKey(key: string): string {
    const map: Record<string, string> = {
      arrowup: "up",
      arrowdown: "down",
      arrowleft: "left",
      arrowright: "right",
      w: "up",
      a: "left",
      s: "down",
      d: "right",
    };
    return map[key] ?? "";
  }

  private stepMove() {
    const dx =
      (this.keys.has("right") ? 1 : 0) - (this.keys.has("left") ? 1 : 0);
    const dy = (this.keys.has("down") ? 1 : 0) - (this.keys.has("up") ? 1 : 0);
    if (dx === 0 && dy === 0) {
      if (this.moveTimer !== null) {
        clearInterval(this.moveTimer);
        this.moveTimer = null;
      }
      return;
    }
    if (dx !== 0 && dy !== 0) return; // server accepts single-axis moves only
    const nx = Math.max(0, Math.min(this.worldW - 1, this.self.x + dx));
    const ny = Math.max(0, Math.min(this.worldH - 1, this.self.y + dy));
    if (nx === this.self.x && ny === this.self.y) return;
    this.self.x = nx;
    this.self.y = ny;
    this.lastMoveX = dx;
    this.lastMoveY = dy;
    this.onSendMove?.(nx, ny);
  }

  pointerDown(px: number, py: number) {
    if (!this.editMode) return;
    const wx = this.cameraX + px / this.zoom;
    const wy = this.cameraY + py / this.zoom;
    this.onPlace?.(Math.round(wx), Math.round(wy));
  }

  zoomAt(cx: number, cy: number, factor: number) {
    const before = this.zoom;
    const zoom = Math.min(2.5, Math.max(0.25, before * Math.pow(1.15, factor)));
    if (zoom === before) return;
    const wx = this.cameraX + cx / before;
    const wy = this.cameraY + cy / before;
    this.zoom = zoom;
    this.cameraX = Math.max(
      0,
      Math.min(this.worldW - this.viewW() / zoom, wx - cx / zoom)
    );
    this.cameraY = Math.max(
      0,
      Math.min(this.worldH - this.viewH() / zoom, wy - cy / zoom)
    );
  }

  private viewW() {
    return this.canvas.clientWidth;
  }

  private viewH() {
    return this.canvas.clientHeight;
  }

  private tick(now: number) {
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.time += dt;

    const lerp = Math.min(1, dt * 14);
    this.displayX += (this.self.x - this.displayX) * lerp;
    this.displayY += (this.self.y - this.displayY) * lerp;

    for (const p of this.remote.values()) {
      p.x += (p.targetX - p.x) * lerp;
      p.y += (p.targetY - p.y) * lerp;
    }

    const viewW = this.viewW();
    const viewH = this.viewH();
    const targetCamX = this.displayX - viewW / (2 * this.zoom);
    const targetCamY = this.displayY - viewH / (2 * this.zoom);
    const camLerp = Math.min(1, dt * 6);
    this.cameraX += (targetCamX - this.cameraX) * camLerp;
    this.cameraY += (targetCamY - this.cameraY) * camLerp;
    this.cameraX = Math.max(
      0,
      Math.min(this.worldW - viewW / this.zoom, this.cameraX)
    );
    this.cameraY = Math.max(
      0,
      Math.min(this.worldH - viewH / this.zoom, this.cameraY)
    );

    this.preloadVisible();
    this.draw(viewW, viewH);
    this.telemetryCb?.();
  }

  private preloadVisible() {
    const margin = 120;
    const left = this.cameraX - margin;
    const top = this.cameraY - margin;
    const right = this.cameraX + this.viewW() / this.zoom + margin;
    const bottom = this.cameraY + this.viewH() / this.zoom + margin;

    let budget = 6;
    for (const el of this.elements) {
      const { element, x, y } = el;
      if (!isValidImageUrl(element.imageUrl)) continue;
      if (x + element.width < left || x > right) continue;
      if (y + element.height < top || y > bottom) continue;
      if (this.images.has(element.imageUrl)) continue;
      if (budget-- <= 0) break;
      this.loadAvatar(element.imageUrl);
    }
  }

  private draw(viewW: number, viewH: number) {
    const { ctx } = this;
    ctx.setTransform(
      this.zoom,
      0,
      0,
      this.zoom,
      -this.cameraX * this.zoom,
      -this.cameraY * this.zoom
    );

    ctx.fillStyle = "#070812";
    ctx.fillRect(this.cameraX, this.cameraY, viewW / this.zoom, viewH / this.zoom);

    this.drawGrid(ctx, viewW, viewH);
    this.drawParticles(ctx);
    this.drawElements(ctx);

    if (this.editMode && this.selectedElement) {
      this.drawSelectionGhost(ctx);
    }

    this.drawPlayers(ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawVignette(ctx, viewW, viewH);
    this.drawMinimap(ctx, viewW, viewH);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    const startX = Math.max(0, Math.floor(this.cameraX / TILE) * TILE);
    const startY = Math.max(0, Math.floor(this.cameraY / TILE) * TILE);
    const endX = Math.min(this.worldW, this.cameraX + viewW / this.zoom);
    const endY = Math.min(this.worldH, this.cameraY + viewH / this.zoom);

    ctx.strokeStyle = "rgba(124, 92, 255, 0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += TILE) {
      ctx.moveTo(x, Math.max(0, this.cameraY));
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += TILE) {
      ctx.moveTo(Math.max(0, this.cameraX), y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(124, 92, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, this.worldW - 1, this.worldH - 1);

    if (startX < this.worldW) {
      ctx.fillStyle = "rgba(124, 92, 255, 0.55)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`${this.worldW} x ${this.worldH}`, 8, 16);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    const vw = this.viewW() / this.zoom;
    const vh = this.viewH() / this.zoom;
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = this.worldW;
      if (p.x > this.worldW) p.x = 0;
      if (p.y < 0) p.y = this.worldH;
      if (p.y > this.worldH) p.y = 0;
      if (p.x < this.cameraX || p.x > this.cameraX + vw) continue;
      if (p.y < this.cameraY || p.y > this.cameraY + vh) continue;
      ctx.beginPath();
      ctx.fillStyle = `rgba(160, 190, 255, ${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawElements(ctx: CanvasRenderingContext2D) {
    const margin = 120;
    const left = this.cameraX - margin;
    const top = this.cameraY - margin;
    const right = this.cameraX + this.viewW() / this.zoom + margin;
    const bottom = this.cameraY + this.viewH() / this.zoom + margin;

    for (const el of this.elements) {
      const { element, x, y } = el;
      if (x + element.width < left || x > right) continue;
      if (y + element.height < top || y > bottom) continue;
      ctx.globalAlpha = this.ghostStatic && element.static ? 0.15 : 1;
      this.drawElement(ctx, element, x, y);
      ctx.globalAlpha = 1;
    }

    if (this.ghostStatic) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(
        "ghost mode: static objects faded [E]",
        this.cameraX + 8,
        this.cameraY + 34
      );
    }
  }

  private drawElement(
    ctx: CanvasRenderingContext2D,
    element: Element,
    x: number,
    y: number
  ) {
    const img = this.images.get(element.imageUrl);
    if (img && img !== "failed") {
      ctx.drawImage(img, x, y, element.width, element.height);
      if (element.static) {
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, element.width, element.height);
      }
      return;
    }

    const idx = element.imageUrl.length % FALLBACK_COLORS.length;
    const { bg, edge } = FALLBACK_COLORS[idx];
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, element.width, element.height);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, element.width, element.height);

    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(x + element.width / 2, y + element.height / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSelectionGhost(ctx: CanvasRenderingContext2D) {
    if (!this.selectedElement) return;
    const el = this.selectedElement;
    const cx = this.cameraX + this.viewW() / (2 * this.zoom);
    const cy = this.cameraY + this.viewH() / (2 * this.zoom);
    ctx.fillStyle = "rgba(124, 92, 255, 0.25)";
    ctx.fillRect(cx, cy, el.width, el.height);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, el.width, el.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(167, 139, 250, 0.9)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("click to place", cx + 4, cy - 6);
  }

  private drawPlayers(ctx: CanvasRenderingContext2D) {
    const vw = this.viewW() / this.zoom;
    const vh = this.viewH() / this.zoom;

    for (const p of this.remote.values()) {
      if (p.x < this.cameraX || p.x > this.cameraX + vw) continue;
      if (p.y < this.cameraY || p.y > this.cameraY + vh) continue;
      const facing =
        p.targetX > p.x ? 1 : p.targetX < p.x ? -1 : p.targetY > p.y ? 2 : p.targetY < p.y ? -2 : 0;
      this.drawAvatar(
        ctx,
        p.x,
        p.y,
        `hsl(${hashHue(p.id)} 85% 65%)`,
        p.name,
        p.avatarUrl,
        false,
        facing,
        p.status,
        p.emote
      );
    }

    const selfFacing =
      this.lastMoveX > 0
        ? 1
        : this.lastMoveX < 0
          ? -1
          : this.lastMoveY > 0
            ? 2
            : this.lastMoveY < 0
              ? -2
              : 0;
    this.drawAvatar(
      ctx,
      this.displayX,
      this.displayY,
      this.myColor,
      this.myName,
      this.selfAvatarUrl,
      true,
      selfFacing,
      this.away ? "away" : "online",
      null
    );
  }

  private drawAvatar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    name: string,
    avatarUrl: string | null,
    isSelf: boolean,
    facing: number,
    status: "online" | "away",
    emote: { text: string; ts: number } | null
  ) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    const glow = ctx.createRadialGradient(x, y, 2, x, y, PLAYER_RADIUS * 3.2);
    glow.addColorStop(0, this.withAlpha(color, status === "away" ? 0.18 : 0.5));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS * 3, 0, Math.PI * 2);
    ctx.fill();

    if (status === "away") {
      ctx.globalAlpha = 0.55;
    }

    ctx.fillStyle = this.withAlpha(color, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS + 2.5, 0, Math.PI * 2);
    ctx.fill();

    const avatarImg = avatarUrl ? this.images.get(avatarUrl) : undefined;
    if (avatarImg && avatarImg !== "failed") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.clip();
      const size = PLAYER_RADIUS * 2.6;
      ctx.drawImage(avatarImg, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = this.withAlpha(color, 1);
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(10, 12, 24, 0.9)";
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (status === "away") {
      ctx.globalAlpha = 1;
    }

    if (facing === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x + PLAYER_RADIUS - 2, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (facing === -1) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x - PLAYER_RADIUS + 2, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (facing === 2) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x, y + PLAYER_RADIUS - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (facing === -2) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x, y - PLAYER_RADIUS + 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isSelf) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS + 5 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (emote) {
      const age = (performance.now() - emote.ts) / 1000;
      if (age < 2.5) {
        const fade = age < 2 ? 1 : 1 - (age - 2) / 0.5;
        ctx.globalAlpha = fade;
        ctx.font = "26px serif";
        ctx.textAlign = "center";
        const bob = Math.sin(this.time * 4) * 3;
        ctx.fillText(emote.text, x, y - PLAYER_RADIUS - 40 + bob);
        ctx.textAlign = "start";
        ctx.globalAlpha = 1;
      }
    }

    const awayMark = status === "away" ? " ◐" : "";
    ctx.font = "11px ui-monospace, monospace";
    const text = `${name}${awayMark}`;
    const tw = ctx.measureText(text).width;
    const bx = x - tw / 2 - 5;
    const by = y - PLAYER_RADIUS - 20;
    ctx.fillStyle = "rgba(7, 8, 18, 0.8)";
    ctx.fillRect(bx, by, tw + 10, 15);
    ctx.strokeStyle =
      status === "away" ? "rgba(251,191,36,0.5)" : "rgba(124, 92, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, tw + 10, 15);
    ctx.fillStyle = "rgba(230, 235, 255, 0.95)";
    ctx.fillText(text, x - tw / 2, by + 11);
  }

  private withAlpha(color: string, alpha: number): string {
    const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
    if (!match) return color;
    return `hsla(${match[1]} ${match[2]}% ${match[3]}% / ${alpha})`;
  }

  private drawVignette(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number
  ) {
    const g = ctx.createRadialGradient(
      viewW / 2,
      viewH / 2,
      Math.min(viewW, viewH) * 0.35,
      viewW / 2,
      viewH / 2,
      Math.max(viewW, viewH) * 0.75
    );
    g.addColorStop(0, "transparent");
    g.addColorStop(1, "rgba(3, 4, 10, 0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number
  ) {
    const mw = Math.min(190, viewW * 0.22);
    const mh = Math.max(60, mw * (this.worldH / this.worldW));
    const mx = viewW - mw - 18;
    const my = viewH - mh - 18;

    ctx.fillStyle = "rgba(8, 10, 22, 0.82)";
    ctx.fillRect(mx - 8, my - 8, mw + 16, mh + 16);
    ctx.strokeStyle = "rgba(124, 92, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 8, my - 8, mw + 16, mh + 16);

    const sx = (x: number) => mx + (x / this.worldW) * mw;
    const sy = (y: number) => my + (y / this.worldH) * mh;

    ctx.fillStyle = "rgba(124, 92, 255, 0.5)";
    for (const el of this.elements) {
      ctx.fillRect(
        sx(el.x) - 1,
        sy(el.y) - 1,
        Math.max(2, (el.element.width / this.worldW) * mw),
        Math.max(2, (el.element.height / this.worldH) * mh)
      );
    }

    ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      sx(this.cameraX),
      sy(this.cameraY),
      (viewW / this.zoom / this.worldW) * mw,
      (viewH / this.zoom / this.worldH) * mh
    );

    for (const p of this.remote.values()) {
      ctx.fillStyle = `hsl(${hashHue(p.id)} 85% 65%)`;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx(this.displayX), sy(this.displayY), 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
