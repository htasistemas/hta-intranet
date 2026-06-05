import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api, storedSession, storeSession } from "@/services/api";
import type { Session } from "@/types";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => storedSession());
  const login = async (email: string, password: string): Promise<void> => {
    const result = await api.post<Session>("/auth/login", { email, password });
    storeSession(result);
    setSession(result);
  };
  const logout = async (): Promise<void> => {
    if (session) await api.post<void>("/auth/logout", { refreshToken: session.refreshToken }).catch(() => undefined);
    storeSession(null);
    setSession(null);
  };
  const value = useMemo(() => ({ session, login, logout }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requer AuthProvider");
  return context;
}
