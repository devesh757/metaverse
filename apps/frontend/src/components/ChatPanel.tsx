"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatEntry {
  userId: string;
  name: string;
  text: string;
  ts: number;
  local?: boolean;
}

export const EMOTES = ["👋", "😂", "❤️", "🎉", "😮", "👍", "💪", "✨", "🔥", "👏"];

interface ChatPanelProps {
  open: boolean;
  messages: ChatEntry[];
  players: { userId: string; name: string; status: string }[];
  onSend: (text: string) => void;
  onEmote: (emote: string) => void;
  onToggle: () => void;
}

export default function ChatPanel({
  open,
  messages,
  players,
  onSend,
  onEmote,
  onToggle,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  return (
    <>
      <button
        onClick={onToggle}
        className={`glass pointer-events-auto absolute bottom-6 right-5 z-30 rounded-xl px-4 py-3 font-display text-xs font-black tracking-widest uppercase transition hover:border-neon/60 ${
          open ? "border-neon/60 text-neon-2" : "text-white/70"
        }`}
        title="Toggle chat"
      >
        💬 Chat
      </button>

      {open && (
        <div className="glass pointer-events-auto absolute bottom-20 right-5 z-30 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
          <div className="border-b border-edge px-4 py-3">
            <h3 className="font-display text-xs font-black tracking-[0.2em] text-white uppercase">
              Space chat
            </h3>
          </div>

          <div className="flex max-h-40 items-start gap-1 overflow-x-auto px-3 py-2">
            {players.slice(0, 12).map((p) => (
              <div
                key={p.userId}
                title={p.name}
                className="flex min-w-8 flex-col items-center gap-1 rounded-lg px-1 py-1"
              >
                <span
                  className={`h-6 w-6 rounded-full ${
                    p.status === "away" ? "bg-amber-400/70" : "bg-mint/80"
                  }`}
                />
                <span className="max-w-12 truncate text-[9px] text-white/60">
                  {p.name.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>

          <div
            ref={listRef}
            className="scroll-slim h-48 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <p className="pt-6 text-center text-xs text-white/35">
                Say hello to the grid 👋
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`mb-2 ${m.local ? "text-right" : ""}`}
                >
                  <span className="text-[10px] font-bold text-neon-2">
                    {m.local ? "you" : m.name}
                  </span>
                  <div
                    className={`mt-0.5 inline-block max-w-full break-words rounded-lg px-2.5 py-1.5 text-xs ${
                      m.local
                        ? "bg-neon/25 text-white"
                        : "bg-panel text-white/85"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-t border-edge px-2 py-1.5">
            {EMOTES.map((e) => (
              <button
                key={e}
                onClick={() => onEmote(e)}
                className="shrink-0 rounded-lg px-2 py-1 text-base transition hover:bg-neon/20"
                title={`Send ${e}`}
              >
                {e}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-edge p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onSend(text.trim());
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message… [Enter]"
              className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition focus:border-neon"
              maxLength={500}
            />
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-neon to-neon-2 px-3 py-2 text-xs font-black text-black"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
