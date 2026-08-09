"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}

const PRESETS = [
  { label: "Pocket", dims: "100x100", w: 100, h: 100 },
  { label: "Island", dims: "400x300", w: 400, h: 300 },
  { label: "City", dims: "800x800", w: 800, h: 800 },
  { label: "Realm", dims: "1600x1200", w: 1600, h: 1200 },
];

export default function CreateSpaceModal({
  open,
  onClose,
  onCreated,
}: CreateSpaceModalProps) {
  const [name, setName] = useState("");
  const [w, setW] = useState(400);
  const [h, setH] = useState(300);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.createSpace({
        name: name.trim() || "Untitled Space",
        dimensions: `${w}x${h}`,
      });
      onCreated(res.spaceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create space");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-3xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-black tracking-[0.2em] text-white uppercase">
            New Space
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-white/60 transition hover:border-neon hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Neon Sanctuary"
              className="w-full rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon focus:shadow-[0_0_16px_rgba(124,92,255,0.25)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase">
              Dimensions
            </label>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.dims}
                  type="button"
                  onClick={() => {
                    setW(p.w);
                    setH(p.h);
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                    w === p.w && h === p.h
                      ? "border-neon bg-neon/15 text-white"
                      : "border-edge bg-panel text-white/50 hover:border-neon/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={10}
                max={9999}
                value={w}
                onChange={(e) => setW(Number(e.target.value))}
                className="w-full rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-white outline-none transition focus:border-neon"
              />
              <span className="font-display text-white/50">×</span>
              <input
                type="number"
                min={10}
                max={9999}
                value={h}
                onChange={(e) => setH(Number(e.target.value))}
                className="w-full rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-white outline-none transition focus:border-neon"
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              {w * h > 10000 ? "Large world — zoom out to see it all." : "Cozy world — fits on one screen."}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-neon to-neon-2 py-3.5 font-display text-sm font-black tracking-widest text-black uppercase shadow-[0_0_30px_rgba(124,92,255,0.45)] transition hover:shadow-[0_0_45px_rgba(34,211,238,0.55)] disabled:opacity-60"
          >
            {loading ? "Materializing…" : "Generate Space"}
          </button>
        </form>
      </div>
    </div>
  );
}
