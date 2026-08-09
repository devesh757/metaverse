"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CanvasBackground from "@/components/CanvasBackground";
import CreateSpaceModal from "@/components/CreateSpaceModal";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SpaceSummary } from "@/lib/types";

function spaceColor(id: string) {
  const hues = [
    "from-violet-600/40 to-fuchsia-500/20",
    "from-cyan-500/40 to-blue-600/20",
    "from-emerald-500/30 to-teal-600/20",
    "from-amber-500/30 to-orange-600/20",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % hues.length;
  return hues[h];
}

export default function SpacesPage() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const res = await api.mySpaces();
      setSpaces(res.spaces);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load spaces");
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        signOut();
        router.push("/signin");
      }
    }
  }, [session, router, signOut]);

  useEffect(() => {
    if (!session) {
      router.replace("/signin");
      return;
    }
    load();
  }, [session, router, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Destroy this space? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api.deleteSpace(id);
      setSpaces((s) => (s ? s.filter((sp) => sp.id !== id) : s));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete space");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-y-auto">
      <CanvasBackground />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge/60 bg-void/70 px-6 py-4 backdrop-blur-xl md:px-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon/50 bg-panel text-base text-neon-2"
          >
            ◈
          </Link>
          <div>
            <h1 className="font-display text-sm font-black tracking-[0.25em] text-white uppercase">
              My Spaces
            </h1>
            <p className="text-xs text-white/40">
              {session?.username ?? session?.userId?.slice(0, 8)} ·{" "}
              {session?.role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-gradient-to-r from-neon to-neon-2 px-4 py-2 text-sm font-bold text-black shadow-[0_0_20px_rgba(124,92,255,0.4)] transition hover:shadow-[0_0_34px_rgba(34,211,238,0.55)]"
          >
            + New Space
          </button>
          <button
            onClick={() => {
              signOut();
              router.push("/");
            }}
            className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-white/60 transition hover:border-red-500/50 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="flex-1 px-6 py-10 md:px-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {spaces === null ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-white/50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon border-t-transparent" />
              Loading worlds…
            </div>
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-edge bg-panel/30 py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-neon/40 bg-neon/10 text-3xl text-neon-2">
              ◈
            </div>
            <h2 className="font-display text-lg font-black tracking-widest text-white uppercase">
              No spaces yet
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/50">
              Create your first world and start placing elements on the grid.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-6 rounded-xl bg-gradient-to-r from-neon to-neon-2 px-6 py-3 font-display text-sm font-black tracking-widest text-black uppercase shadow-[0_0_30px_rgba(124,92,255,0.4)] transition hover:scale-[1.02]"
            >
              Create your first space
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const [w, h] = space.dimensions.split("x").map(Number);
              return (
                <div
                  key={space.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/space/${space.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      router.push(`/space/${space.id}`);
                    }
                  }}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-edge bg-panel/60 text-left backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-neon/60 hover:shadow-[0_10px_50px_rgba(124,92,255,0.25)] ${spaceColor(space.id)}`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br">
                    <div className="relative flex h-24 w-24 items-center justify-center">
                      <span className="absolute inset-0 rounded-full bg-neon/30 blur-xl transition group-hover:bg-neon/50" />
                      <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-neon/50 bg-panel/80 font-display text-xl font-black text-neon-2 transition group-hover:scale-110">
                        ◈
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-bold text-white">
                        {space.name}
                      </h3>
                      <p className="mt-1 text-xs text-white/45">
                        {w} × {h} units
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(space.id, e)}
                      disabled={deleting === space.id}
                      className="rounded-md border border-transparent p-2 text-white/35 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
                      title="Destroy space"
                    >
                      {deleting === space.id ? "…" : "🗑"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <CreateSpaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(spaceId) => {
          setModalOpen(false);
          router.push(`/space/${spaceId}`);
        }}
      />
    </main>
  );
}
