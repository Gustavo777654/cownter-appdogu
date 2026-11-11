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
import type { Fazenda, User } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { limparDadosLocais, prepararAparelho, traduzirErro } from "@/lib/sync";

const STORAGE_KEY = "cownter_user";

// "Estar logado" é uma marca guardada no aparelho: assim o app abre sem internet.
// A sessão do Supabase (token) fica guardada à parte e só é usada para sincronizar.

interface Resultado {
  /** Fazenda da conta; null se a pessoa ainda precisa criar uma ou entrar com um código. */
  fazenda: Fazenda | null;
  nome: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Conta real com fazenda na nuvem (e não o modo local/teste). */
  nuvem: boolean;
  entrar: (email: string, senha: string) => Promise<Resultado>;
  criarConta: (nome: string, email: string, senha: string) => Promise<Resultado>;
  criarFazenda: (nome: string, nomeUsuario: string) => Promise<Fazenda>;
  entrarComCodigo: (codigo: string, nomeUsuario: string) => Promise<Fazenda>;
  /** Conclui o login: liga o aparelho à fazenda (apagando dados de teste) e libera o app. */
  concluir: (fazenda: Fazenda, nome: string, email: string) => Promise<void>;
  /** Há uma conta entrando (sessão no Supabase) mas ainda sem fazenda concluída? */
  sessaoAberta: () => Promise<{ email: string; nome: string } | null>;
  atualizarFazenda: (f: Fazenda) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nomeDe(meta: unknown, email: string): string {
  const n = (meta as { nome?: string } | null | undefined)?.nome;
  return n && n.trim() ? n.trim() : email.split("@")[0];
}

function traduzirAuth(e: unknown): Error {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/invalid login credentials/i.test(msg)) return new Error("E-mail ou senha incorretos.");
  if (/email not confirmed/i.test(msg)) return new Error("Confirme seu e-mail pelo link que enviamos e tente entrar de novo.");
  if (/already registered|already been registered/i.test(msg)) return new Error("Já existe uma conta com este e-mail. Use Entrar.");
  if (/password should be at least|weak password/i.test(msg)) return new Error("A senha precisa ter pelo menos 6 caracteres.");
  if (/rate limit|too many/i.test(msg)) return new Error("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
  if (/invalid email|unable to validate email/i.test(msg)) return new Error("E-mail inválido.");
  if (/failed to fetch|network|fetch failed|load failed/i.test(msg)) return new Error("Sem internet. Para criar conta ou entrar pela primeira vez é preciso estar online.");
  return new Error(traduzirErro(e));
}

function lerFazenda(linhas: unknown): Fazenda | null {
  const l = Array.isArray(linhas) ? linhas[0] : null;
  if (!l) return null;
  return { id: l.id, nome: l.nome, codigo: l.codigo ?? null, papel: l.papel };
}

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

  const guardar = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sem armazenamento */
    }
  }, []);

  const entrar = useCallback(async (email: string, senha: string): Promise<Resultado> => {
    const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) throw traduzirAuth(error);
    const { data: f, error: e2 } = await supabase().rpc("minha_fazenda");
    if (e2) throw traduzirAuth(e2);
    return { fazenda: lerFazenda(f), nome: nomeDe(data.user?.user_metadata, email) };
  }, []);

  const criarConta = useCallback(async (nome: string, email: string, senha: string): Promise<Resultado> => {
    const { data, error } = await supabase().auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
    if (error) throw traduzirAuth(error);
    if (!data.session) {
      throw new Error("Enviamos um link de confirmação para o seu e-mail. Confirme e depois use Entrar.");
    }
    return { fazenda: null, nome: nome.trim() || nomeDe(data.user?.user_metadata, email) };
  }, []);

  const criarFazenda = useCallback(async (nome: string, nomeUsuario: string): Promise<Fazenda> => {
    const { data, error } = await supabase().rpc("criar_fazenda", { p_nome: nome, p_nome_usuario: nomeUsuario });
    if (error) throw traduzirAuth(error);
    const f = lerFazenda(data);
    if (!f) throw new Error("Não foi possível criar a fazenda.");
    return f;
  }, []);

  const entrarComCodigo = useCallback(async (codigo: string, nomeUsuario: string): Promise<Fazenda> => {
    const { data, error } = await supabase().rpc("entrar_na_fazenda", { p_codigo: codigo, p_nome_usuario: nomeUsuario });
    if (error) throw traduzirAuth(error);
    const f = lerFazenda(data);
    if (!f) throw new Error("Não foi possível entrar na fazenda.");
    return f;
  }, []);

  const concluir = useCallback(
    async (fazenda: Fazenda, nome: string, email: string) => {
      await prepararAparelho(fazenda.id);
      guardar({ email, name: nome, farm: fazenda.nome, fazendaId: fazenda.id, papel: fazenda.papel });
    },
    [guardar]
  );

  const sessaoAberta = useCallback(async () => {
    try {
      const { data } = await supabase().auth.getSession();
      const u = data.session?.user;
      return u ? { email: u.email ?? "", nome: nomeDe(u.user_metadata, u.email ?? "") } : null;
    } catch {
      return null;
    }
  }, []);

  const atualizarFazenda = useCallback(
    (f: Fazenda) => {
      setUser((atual) => {
        if (!atual) return atual;
        const novo = { ...atual, farm: f.nome, papel: f.papel };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(novo));
        } catch {
          /* sem armazenamento */
        }
        return novo;
      });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await supabase().auth.signOut({ scope: "local" });
    } catch {
      /* sem internet: a sessão local é removida mesmo assim */
    }
    // Apaga os dados do aparelho para que a próxima conta não se misture com esta.
    await limparDadosLocais();
    guardar(null);
  }, [guardar]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      nuvem: !!user?.fazendaId,
      entrar,
      criarConta,
      criarFazenda,
      entrarComCodigo,
      concluir,
      sessaoAberta,
      atualizarFazenda,
      logout,
    }),
    [user, isLoading, entrar, criarConta, criarFazenda, entrarComCodigo, concluir, sessaoAberta, atualizarFazenda, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
