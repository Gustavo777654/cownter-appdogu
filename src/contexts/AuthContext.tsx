"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";

const STORAGE_KEY = "cownter_user";

// Autenticação provisória do protótipo: valida no próprio aparelho, sem servidor,
// para o login também funcionar offline. Será substituída por autenticação real
// (com token guardado no aparelho) quando o backend for criado.
const USUARIO_DEMO = {
  email: "demo@cownter.com",
  password: "demo123",
  user: { email: "demo@cownter.com", name: "Geraldo Neto", farm: "Fazenda Demo" } as User,
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) setUser(JSON.parse(salvo) as User);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const ok =
      email.trim().toLowerCase() === USUARIO_DEMO.email &&
      password === USUARIO_DEMO.password;
    if (!ok) throw new Error("E-mail ou senha incorretos.");
    setUser(USUARIO_DEMO.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(USUARIO_DEMO.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
