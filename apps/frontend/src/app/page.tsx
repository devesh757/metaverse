"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CanvasBackground from "@/components/CanvasBackground";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  {
    icon: "◈",
    title: "Shared Grid",
    desc: "Every world is a living canvas — anyone inside can see you move in real time.",
  },
  {
    icon: "✧",
    title: "Build Anything",
    desc: "Open edit mode and stamp elements onto the world. Your space, your layout.",
  },
  {
    icon: "⌖",
    title: "Real-time Presence",
    desc: "Smooth interpolated movement, live minimap and glowing avatars for every explorer.",
  },
  {
    icon: "∞",
    title: "Infinite Dimensions",
    desc: "Spaces up to 9999 x 9999 units. Zoom out, explore far corners, get lost.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { session } = useAuth();

  return (
    <main className="relative flex h-full min-h-screen flex-col overflow-y-auto">
      <CanvasBackground />

      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 rounded-xl bg-neon/40 blur-md animate-pulse-ring" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-neon/50 bg-panel text-lg font-black text-neon-2">
              ◈
            </span>
          </div>
          <div className="font-display text-lg font-bold tracking-[0.3em] text-white">
            NEXUS
          </div>
        </div>

        <nav className="flex items-center gap-3">
          {session ? (
            <>
              <Link
                href="/spaces"
                className="rounded-lg border border-neon/40 px-5 py-2 text-sm font-semibold text-white transition hover:border-neon hover:bg-neon/10"
              >
                My Spaces
              </Link>
              <Link
                href="/spaces"
                className="rounded-lg bg-gradient-to-r from-neon to-neon-2 px-5 py-2 text-sm font-bold text-black shadow-[0_0_24px_rgba(124,92,255,0.5)] transition hover:shadow-[0_0_40px_rgba(34,211,238,0.6)]"
              >
                Enter NEXUS
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-lg border border-neon/40 px-5 py-2 text-sm font-semibold text-white transition hover:border-neon hover:bg-neon/10"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-gradient-to-r from-neon to-neon-2 px-5 py-2 text-sm font-bold text-black shadow-[0_0_24px_rgba(124,92,255,0.5)] transition hover:shadow-[0_0_40px_rgba(34,211,238,0.6)]"
              >
                Start Exploring
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-10 text-center">
        <div className="animate-float-y mb-8 flex items-center gap-3 rounded-full border border-neon/30 bg-panel/60 px-5 py-2 backdrop-blur">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
          </span>
          <span className="text-xs font-medium tracking-[0.25em] text-mint uppercase">
            2D World · Live WebSocket Sync
          </span>
        </div>

        <h1 className="max-w-4xl font-display text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
          STEP INTO THE
          <br />
          <span className="shimmer-text text-glow">SHARED CANVAS</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
          NEXUS is a 2D metaverse rendered entirely on canvas. Wander endless
          grids, watch strangers drift past in real time, and sculpt the world
          around you — one element at a time.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => router.push(session ? "/spaces" : "/signup")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-neon via-neon-2 to-mint px-8 py-4 font-display text-base font-bold text-black shadow-[0_0_40px_rgba(124,92,255,0.45)] transition hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,211,238,0.55)]"
          >
            <span className="relative z-10">
              {session ? "Enter your spaces →" : "Create your world →"}
            </span>
            <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
          </button>

          <button
            onClick={() =>
              document
                .getElementById("features")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-xl border border-edge bg-panel/70 px-8 py-4 font-display text-base font-bold text-white/80 backdrop-blur transition hover:border-neon/60 hover:text-white"
          >
            How it works
          </button>
        </div>

        <div className="mt-14 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass group rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-neon/50 hover:shadow-[0_8px_40px_rgba(124,92,255,0.2)]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neon/15 text-xl text-neon-2 transition group-hover:bg-neon/25">
                {f.icon}
              </div>
              <h3 className="mb-1.5 font-display text-sm font-bold tracking-widest text-white uppercase">
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed text-white/55">{f.desc}</p>
            </div>
          ))}
        </div>

        <div
          id="features"
          className="mt-20 w-full max-w-5xl rounded-3xl border border-edge bg-panel/50 p-8 text-left backdrop-blur md:p-10"
        >
          <h2 className="font-display text-2xl font-bold tracking-wide text-white">
            HOW IT WORKS
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Join a space", d: "Sign in and open one of your spaces — or create a brand new one with custom dimensions." },
              { n: "02", t: "Move in real time", d: "Use WASD or arrow keys. Your position is verified by the server and streamed to everyone else over WebSockets." },
              { n: "03", t: "Shape the world", d: "Flip into edit mode, pick an element from the palette, and click anywhere to place it. The grid remembers." },
            ].map((s) => (
              <div key={s.n} className="relative border-l-2 border-neon/40 pl-5">
                <span className="font-display text-3xl font-black text-neon/50">
                  {s.n}
                </span>
                <h3 className="mt-2 font-display text-sm font-bold tracking-widest text-white uppercase">
                  {s.t}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-16 pb-8 text-xs tracking-widest text-white/30 uppercase">
          NEXUS · canvas-born metaverse · built on Next.js + WebSockets
        </footer>
      </section>
    </main>
  );
}
