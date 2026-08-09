"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CanvasBackground from "@/components/CanvasBackground";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface AuthCardProps {
  mode: "signin" | "signup";
}

export default function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState<"user" | "admin">("user");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignin = mode === "signin";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignin) {
        const { token } = await api.signin(username, password);
        const [, payloadB64] = token.split(".");
        let role: "Admin" | "User" = "User";
        let userId = "";
        try {
          const payload = JSON.parse(atob(payloadB64));
          role = payload.role === "Admin" ? "Admin" : "User";
          userId = payload.userId;
        } catch {
          userId = payloadB64;
        }
        signIn(token, userId, role, username);
        router.push("/spaces");
      } else {
        await api.signup(username, password, type);
        const { token } = await api.signin(username, password);
        let role: "Admin" | "User" = "User";
        let userId = "";
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          role = payload.role === "Admin" ? "Admin" : "User";
          userId = payload.userId;
        } catch {
          userId = token;
        }
        signIn(token, userId, role, username);
        router.push("/spaces");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "w-full rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-neon focus:shadow-[0_0_16px_rgba(124,92,255,0.25)]";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <CanvasBackground />

      <div className="glass w-full max-w-md rounded-3xl p-8 shadow-[0_0_60px_rgba(124,92,255,0.15)] md:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neon/50 bg-panel text-2xl text-neon-2 shadow-[0_0_30px_rgba(124,92,255,0.4)]">
            ◈
          </div>
          <h1 className="font-display text-2xl font-black tracking-[0.2em] text-white">
            {isSignin ? "WELCOME BACK" : "JOIN THE GRID"}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {isSignin
              ? "Sign in to enter your spaces"
              : "Create an account to start building"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase">
              Email
            </label>
            <input
              type="email"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com"
              className={input}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 characters"
              className={input}
            />
          </div>

          {!isSignin && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase">
                Account type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["user", "admin"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition ${
                      type === t
                        ? "border-neon bg-neon/15 text-white shadow-[0_0_16px_rgba(124,92,255,0.3)]"
                        : "border-edge bg-panel text-white/50 hover:border-neon/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {loading
              ? isSignin
                ? "AUTHENTICATING…"
                : "CREATING…"
              : isSignin
                ? "Enter Nexus"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          {isSignin ? "New to the grid?" : "Already have an account?"}{" "}
          <Link
            href={isSignin ? "/signup" : "/signin"}
            className="font-semibold text-neon-2 transition hover:text-white"
          >
            {isSignin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
