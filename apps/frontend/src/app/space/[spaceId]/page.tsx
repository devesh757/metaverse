"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import GameCanvas, {
  type GameApi,
  type PresenceEvent,
  type Telemetry,
} from "@/components/GameCanvas";
import ChatPanel, { type ChatEntry } from "@/components/ChatPanel";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Avatar, Element, SpaceDetail } from "@/lib/types";

interface PlayerInfo {
  userId: string;
  name: string;
  status: "online" | "away";
}

interface Toast {
  id: number;
  text: string;
}

export default function SpacePage() {
  const params = useParams<{ spaceId: string }>();
  const spaceId = params.spaceId;
  const router = useRouter();
  const { session } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<GameApi | null>(null);

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [entered, setEntered] = useState(false);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    x: 0,
    y: 0,
    online: 1,
    connected: false,
    away: false,
  });
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Element | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [spaceRes, elementsRes] = await Promise.all([
        api.getSpace(spaceId),
        api.elements(),
      ]);
      setSpace(spaceRes);
      setElements(elementsRes.elements);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Failed to load space"
      );
    }
  }, [spaceId]);

  useEffect(() => {
    if (!session) {
      router.replace("/signin");
      return;
    }
    load();
    api.avatars().then((r) => setAvatars(r.avatars)).catch(() => {});
  }, [session, router, load]);

  const savedAvatar =
    typeof window !== "undefined"
      ? sessionStorage.getItem(`nexus_avatar_${spaceId}`)
      : null;

  useEffect(() => {
    if (savedAvatar) setMyAvatar(savedAvatar);
  }, [savedAvatar]);

  useEffect(() => {
    if (editMode && elements.length > 0 && !selected) {
      setSelected(elements[0]);
    }
  }, [editMode, elements, selected]);

  const handlePlace = useCallback(
    async (x: number, y: number) => {
      if (!selected || !space) return;
      setPlacing(true);
      try {
        await api.addElementToSpace({ spaceId, elementId: selected.id, x, y });
        setSpace((s) =>
          s
            ? {
                ...s,
                elements: [
                  ...s.elements,
                  { id: `${Date.now()}`, element: selected, x, y },
                ],
              }
            : s
        );
      } catch (err) {
        setLoadError(
          err instanceof ApiError ? err.message : "Failed to place element"
        );
      } finally {
        setPlacing(false);
      }
    },
    [selected, space, spaceId]
  );

  const handleEnter = async () => {
    if (!session) return;
    if (myAvatar) {
      try {
        await api.updateMetadata(myAvatar);
      } catch {
        // non-fatal: avatar is cosmetic
      }
      sessionStorage.setItem(`nexus_avatar_${spaceId}`, myAvatar);
    }
    setEntered(true);
  };

  const handlePresence = useCallback(
    (p: PresenceEvent) => {
      if (p.type === "join") {
        setPlayers((list) => {
          if (list.some((x) => x.userId === p.userId)) return list;
          return [
            ...list,
            { userId: p.userId, name: p.name, status: "online" as const },
          ];
        });
        pushToast(`${p.name} joined the space`);
      } else {
        setPlayers((list) => list.filter((x) => x.userId !== p.userId));
        pushToast(`${p.name} left the space`);
      }
    },
    [pushToast]
  );

  const handleChat = useCallback(
    (m: { userId: string; name: string; text: string; ts: number }) => {
      setChatMessages((list) => [
        ...list.slice(-99),
        { ...m, local: m.userId === session?.userId },
      ]);
    },
    [session]
  );

  const handleStatus = useCallback((userId: string, status: "online" | "away") => {
    setPlayers((list) =>
      list.map((p) => (p.userId === userId ? { ...p, status } : p))
    );
  }, []);

  const handleInitialPlayers = useCallback(
    (players: { userId: string; name: string }[]) => {
      setPlayers(
        players.map((p) => ({ userId: p.userId, name: p.name, status: "online" as const }))
      );
    },
    []
  );

  const sendChat = (text: string) => {
    apiRef.current?.sendChat(text);
    setChatMessages((list) => [
      ...list.slice(-99),
      {
        userId: session?.userId ?? "me",
        name: session?.username ?? "you",
        text,
        ts: Date.now(),
        local: true,
      },
    ]);
  };

  const sendEmote = (emote: string) => {
    apiRef.current?.sendEmote(emote);
  };

  if (!session) return null;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6">
        <div className="glass max-w-md rounded-3xl p-10 text-center">
          <div className="mb-4 text-4xl text-red-400">⚠</div>
          <h1 className="font-display text-lg font-black tracking-widest text-white uppercase">
            Lost in the void
          </h1>
          <p className="mt-2 text-sm text-white/55">{loadError}</p>
          <Link
            href="/spaces"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-neon to-neon-2 px-6 py-3 font-display text-sm font-black tracking-widest text-black uppercase"
          >
            Back to spaces
          </Link>
        </div>
      </main>
    );
  }

  if (!space) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void">
        <div className="flex items-center gap-3 text-white/50">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon border-t-transparent" />
          Entering space…
        </div>
      </main>
    );
  }

  // ── Character select screen ──────────────────────────────
  if (!entered) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-y-auto px-4 py-10">
        <div className="glass w-full max-w-lg rounded-3xl p-8 text-center md:p-10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neon/50 bg-panel text-2xl text-neon-2 shadow-[0_0_30px_rgba(124,92,255,0.4)]">
            ◈
          </div>
          <h1 className="font-display text-xl font-black tracking-[0.2em] text-white uppercase">
            Choose your avatar
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {session.username} · entering space "{spaceId.slice(0, 8)}"
          </p>

          <div className="mt-6 grid grid-cols-4 gap-3">
            {avatars.length === 0 &&
              [0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-3xl transition ${
                    myAvatar === null
                      ? "border-mint bg-mint/10"
                      : "border-edge bg-panel/60 hover:border-neon/60"
                  }`}
                  onClick={() => setMyAvatar(null)}
                >
                  <span
                    className={`h-12 w-12 rounded-full ${
                      ["bg-violet-500/70", "bg-cyan-400/70", "bg-emerald-400/70", "bg-amber-400/70"][i]
                    }`}
                  />
                </div>
              ))}
            {avatars.map((a) => (
              <button
                key={a.id}
                onClick={() => setMyAvatar(a.imageUrl)}
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 transition hover:scale-105 ${
                  myAvatar === a.imageUrl
                    ? "border-mint shadow-[0_0_24px_rgba(52,245,197,0.4)]"
                    : "border-edge bg-panel/60 hover:border-neon/60"
                }`}
                title={a.name}
              >
                <img
                  src={a.imageUrl}
                  alt={a.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {myAvatar === a.imageUrl && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-mint text-[10px] font-black text-black">
                    ✓
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setMyAvatar(null)}
              className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-3xl transition hover:scale-105 ${
                myAvatar === null
                  ? "border-mint shadow-[0_0_24px_rgba(52,245,197,0.4)]"
                  : "border-edge bg-panel/60 hover:border-neon/60"
              }`}
              title="No image (plain orb)"
            >
              <span className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400" />
            </button>
          </div>

          <button
            onClick={handleEnter}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-neon to-neon-2 py-3.5 font-display text-sm font-black tracking-widest text-black uppercase shadow-[0_0_30px_rgba(124,92,255,0.45)] transition hover:shadow-[0_0_45px_rgba(34,211,238,0.55)]"
          >
            Enter space
          </button>
          <button
            onClick={() => router.push("/spaces")}
            className="mt-3 text-xs text-white/40 transition hover:text-white/70"
          >
            ← Back to spaces
          </button>
        </div>
      </main>
    );
  }

  const online = Math.max(1, telemetry.online);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070812]">
      <GameCanvas
        space={space}
        myUserId={session.userId}
        myName={session.username ?? session.userId.slice(0, 6)}
        myAvatarUrl={myAvatar}
        token={session.token}
        onTelemetry={setTelemetry}
        editMode={editMode}
        selectedElement={selected}
        onPlaceElement={handlePlace}
        canvasRef={canvasRef}
        apiRef={apiRef}
        onPresence={handlePresence}
        onChatMessage={handleChat}
        onStatus={handleStatus}
        onInitialPlayers={handleInitialPlayers}
      />

      {/* ── Presence toasts ─────────────────────── */}
      <div className="pointer-events-none absolute left-1/2 top-16 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass animate-float-y rounded-xl px-4 py-2 text-xs text-white/90"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* ── Top HUD ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-5">
        <div className="pointer-events-auto glass flex items-center gap-3 rounded-xl px-4 py-2.5">
          <Link
            href="/spaces"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-white/70 transition hover:border-neon hover:text-white"
            title="Back to spaces"
          >
            ←
          </Link>
          <div>
            <div className="font-display text-xs font-black tracking-[0.2em] text-white uppercase">
              {telemetry.connected ? "LIVE" : "CONNECTING…"}
            </div>
            <div className="text-xs text-white/45">
              {space.dimensions.replace("x", " × ")}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto glass flex items-center gap-3 rounded-xl px-4 py-2.5">
          <span
            className={`relative flex h-2.5 w-2.5 ${telemetry.connected ? "bg-mint" : "bg-amber-400"}`}
          >
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${telemetry.connected ? "bg-mint" : "bg-amber-400"}`}
            />
          </span>
          <span className="font-mono text-xs text-white/80">
            {online} {online === 1 ? "explorer" : "explorers"}
          </span>
          <span className="hidden font-mono text-xs text-white/40 sm:inline">
            x:{telemetry.x} y:{telemetry.y}
          </span>
          {telemetry.away && (
            <span className="font-mono text-[10px] text-amber-300">
              away
            </span>
          )}
        </div>
      </div>

      {/* ── Edit mode toggle ────────────────────── */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
        {editMode && (
          <button
            onClick={() => setPaletteOpen((v) => !v)}
            className="glass rounded-xl px-4 py-3 font-display text-xs font-bold tracking-widest text-neon-2 uppercase transition hover:border-neon/60"
          >
            ▦ Palette
          </button>
        )}
        <button
          onClick={() => {
            setEditMode((v) => !v);
            setPaletteOpen(false);
          }}
          className={`glass rounded-xl px-5 py-3 font-display text-xs font-black tracking-widest uppercase transition ${
            editMode
              ? "border-mint/60 text-mint shadow-[0_0_24px_rgba(52,245,197,0.3)]"
              : "text-white/70 hover:border-neon/60 hover:text-white"
          }`}
        >
          {editMode ? "✓ Editing" : "✎ Edit Mode"}
        </button>
        <button
          onClick={() => router.push("/spaces")}
          className="glass rounded-xl px-5 py-3 font-display text-xs font-bold tracking-widest text-white/70 uppercase transition hover:border-red-500/50 hover:text-red-300"
        >
          Exit
        </button>
      </div>

      {/* ── Player list (right) ─────────────────── */}
      <div className="glass pointer-events-auto absolute right-5 top-20 z-20 hidden w-44 rounded-2xl p-3 md:block">
        <h3 className="mb-2 font-display text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">
          Explorers · {players.length + 1}
        </h3>
        <div className="scroll-slim max-h-40 space-y-1.5 overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg bg-neon/10 px-2 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-mint" />
            </span>
            <span className="truncate text-xs font-semibold text-white">
              {session.username ?? "you"}
            </span>
            <span className="ml-auto text-[9px] text-neon-2">you</span>
          </div>
          {players.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-panel"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${p.status === "away" ? "bg-amber-400" : "bg-mint"}`}
              />
              <span className="truncate text-xs text-white/80">
                {p.name}
              </span>
              {p.status === "away" && (
                <span className="ml-auto text-[9px] text-amber-300">away</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Element palette ─────────────────────── */}
      {editMode && paletteOpen && (
        <div className="glass absolute bottom-24 left-5 z-20 w-64 max-h-[55vh] rounded-2xl p-4 scroll-slim overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-xs font-black tracking-[0.2em] text-white uppercase">
              Elements
            </h3>
            {selected && (
              <span className="rounded bg-neon/20 px-2 py-0.5 font-mono text-[10px] text-neon-2">
                {selected.width}×{selected.height}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {elements.map((el) => {
              const active = selected?.id === el.id;
              return (
                <button
                  key={el.id}
                  onClick={() => setSelected(el)}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-panel/80 transition ${
                    active
                      ? "border-neon shadow-[0_0_20px_rgba(124,92,255,0.45)]"
                      : "border-edge hover:border-neon/50"
                  }`}
                >
                  <img
                    src={el.imageUrl}
                    alt={el.id}
                    className="max-h-full max-w-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="pointer-events-none flex h-10 w-10 items-center justify-center rounded-lg border-2 border-neon/60 text-neon-2">
                    ▦
                  </span>
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[10px] font-black text-black">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            {elements.length === 0 && (
              <p className="col-span-2 py-6 text-center text-xs text-white/40">
                No elements in the library yet.
              </p>
            )}
          </div>
          <p className="mt-3 border-t border-edge pt-3 text-[10px] leading-relaxed text-white/40">
            Click the grid to place the selected element.{" "}
            {placing && "Placing…"}
          </p>
        </div>
      )}

      <ChatPanel
        open={chatOpen}
        messages={chatMessages}
        players={[
          { userId: session.userId, name: session.username ?? "you", status: telemetry.away ? "away" : "online" },
          ...players,
        ]}
        onSend={sendChat}
        onEmote={sendEmote}
        onToggle={() => setChatOpen((v) => !v)}
      />

      {/* ── Bottom-left hint ────────────────────── */}
      {!editMode && (
        <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden flex-col gap-1 font-mono text-[10px] tracking-wider text-white/35 md:flex">
          <span>[W A S D / ← ↑ ↓ →] move</span>
          <span>[scroll] zoom · [E] ghost objects</span>
          <span>[edit mode] place elements</span>
        </div>
      )}
    </main>
  );
}
