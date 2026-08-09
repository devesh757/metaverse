"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clearSession, getSession, saveSession } from "./api";
import type { Session } from "./types";

interface AuthContextValue {
  session: Session | null;
  signIn: (
    token: string,
    userId: string,
    role: Session["role"],
    username: string
  ) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const signIn = useCallback(
    (
      token: string,
      userId: string,
      role: Session["role"],
      username: string
    ) => {
      const next = { token, userId, role, username };
      saveSession(next);
      setSession(next);
    },
    []
  );

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
