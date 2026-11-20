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

/** A conta existe, mas o e-mail ainda não foi confirmado com o código. */
const AVISO_KEY = "cownter_aviso_login";

/** Recado para mostrar na tela de login (ex.: "você foi removido da fazenda"). */
export function lerAvisoDeLogin(): string {
  try {
    const a = localStorage.getItem(AVISO_KEY) ?? "";
    localStorage.removeItem(AVISO_KEY);
    return a;
  } catch {
    return "";
  }
}

export interface Membro {
  user_id: string;
  nome: string | null;
  papel: string;
  voce: boolean;
}

export class PrecisaCodigoErro extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "PrecisaCodigoErro";
  }
}

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
  /** Confirma o e-mail com o código de 6 dígitos recebido. */
  confirmarCodigo: (email: string, codigo: string) => Promise<Resultado>;
  reenviarCodigo: (email: string) => Promise<void>;
  criarFazenda: (nome: string, nomeUsuario: string) => Promise<Fazenda>;
  entrarComCodigo: (codigo: string, nomeUsuario: string) => Promise<Fazenda>;
  /** Conclui o login: liga o aparelho à fazenda (apagando dados de teste) e libera o app. */
  concluir: (fazenda: Fazenda, nome: string, email: string) => Promise<void>;
  /** Há uma conta entrando (sessão no Supabase) mas ainda sem fazenda concluída? */
  sessaoAberta: () => Promise<{ email: string; nome: string } | null>;
  atualizarFazenda: (f: Fazenda) => void;
  logout: () => Promise<void>;
  /** Manda um código de 6 dígitos para o e-mail, para criar uma senha nova. */
  pedirCodigoSenha: (email: string) => Promise<void>;
  /** Confere o código, define a senha nova e entra na conta. */
  redefinirSenha: (email: string, codigo: string, novaSenha: string) => Promise<Resultado>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
  atualizarNome: (nome: string) => Promise<void>;
  renomearFazenda: (nome: string) => Promise<void>;
  listarMembros: () => Promise<Membro[]>;
  removerMembro: (userId: string) => Promise<void>;
  excluirConta: (senha: string) => Promise<void>;
  /** A conta ainda faz parte da fazenda? Se foi removida, sai e avisa. Devolve false nesse caso. */
  verificarVinculo: () => Promise<boolean>;
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
  if (/different from the old password|same password/i.test(msg)) return new Error("A senha nova precisa ser diferente da atual.");
  if (/token has expired|otp_expired|invalid.*token|token.*invalid/i.test(msg)) return new Error("Código incorreto ou vencido. Peça um novo código.");
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
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        throw new PrecisaCodigoErro("Seu e-mail ainda não foi confirmado. Digite o código que enviamos (ou peça um novo).");
      }
      throw traduzirAuth(error);
    }
    const { data: f, error: e2 } = await supabase().rpc("minha_fazenda");
    if (e2) throw traduzirAuth(e2);
    return { fazenda: lerFazenda(f), nome: nomeDe(data.user?.user_metadata, email) };
  }, []);

  const criarConta = useCallback(async (nome: string, email: string, senha: string): Promise<Resultado> => {
    const { data, error } = await supabase().auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
    if (error) throw traduzirAuth(error);
    if (!data.session) {
      throw new PrecisaCodigoErro("Enviamos um código para o seu e-mail. Digite-o abaixo.");
    }
    return { fazenda: null, nome: nome.trim() || nomeDe(data.user?.user_metadata, email) };
  }, []);

  const confirmarCodigo = useCallback(async (email: string, codigo: string): Promise<Resultado> => {
    const { data, error } = await supabase().auth.verifyOtp({ email: email.trim(), token: codigo.replace(/\s/g, ""), type: "signup" });
    if (error) {
      if (/expired|invalid/i.test(error.message)) throw new Error("Código incorreto ou vencido. Confira o e-mail ou peça um novo código.");
      throw traduzirAuth(error);
    }
    const { data: f } = await supabase().rpc("minha_fazenda");
    return { fazenda: lerFazenda(f), nome: nomeDe(data.user?.user_metadata, email) };
  }, []);

  const reenviarCodigo = useCallback(async (email: string): Promise<void> => {
    const { error } = await supabase().auth.resend({ type: "signup", email: email.trim() });
    if (error) throw traduzirAuth(error);
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

  const pedirCodigoSenha = useCallback(async (email: string): Promise<void> => {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim());
    if (error) throw traduzirAuth(error);
  }, []);

  const redefinirSenha = useCallback(async (email: string, codigo: string, novaSenha: string): Promise<Resultado> => {
    if (novaSenha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const { data, error } = await supabase().auth.verifyOtp({ email: email.trim(), token: codigo.replace(/\s/g, ""), type: "recovery" });
    if (error) throw new Error("Código incorreto ou vencido. Confira o e-mail ou peça um novo código.");
    const { error: e2 } = await supabase().auth.updateUser({ password: novaSenha });
    if (e2) {
      // O código só vale uma vez: fecha a sessão para recomeçar do zero.
      await supabase().auth.signOut({ scope: "local" }).catch(() => undefined);
      throw new Error(traduzirAuth(e2).message + " Peça um novo código para tentar de novo.");
    }
    const { data: f } = await supabase().rpc("minha_fazenda");
    return { fazenda: lerFazenda(f), nome: nomeDe(data.user?.user_metadata, email) };
  }, []);

  const trocarSenha = useCallback(
    async (atual: string, nova: string): Promise<void> => {
      if (!user) throw new Error("Entre na sua conta primeiro.");
      if (nova.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (nova === atual) throw new Error("A senha nova precisa ser diferente da atual.");
      const { error } = await supabase().auth.signInWithPassword({ email: user.email, password: atual });
      if (error) throw /invalid login credentials/i.test(error.message) ? new Error("A senha atual está incorreta.") : traduzirAuth(error);
      const { error: e2 } = await supabase().auth.updateUser({ password: nova });
      if (e2) throw traduzirAuth(e2);
    },
    [user]
  );

  const atualizarNome = useCallback(
    async (nome: string): Promise<void> => {
      const limpo = nome.trim();
      if (!limpo) throw new Error("Informe o seu nome.");
      const { error } = await supabase().rpc("atualizar_meu_nome", { p_nome: limpo });
      if (error) throw traduzirAuth(error);
      await supabase().auth.updateUser({ data: { nome: limpo } }).catch(() => undefined);
      setUser((atual) => {
        if (!atual) return atual;
        const novo = { ...atual, name: limpo };
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

  const renomearFazenda = useCallback(async (nome: string): Promise<void> => {
    const { data, error } = await supabase().rpc("renomear_fazenda", { p_nome: nome });
    if (error) throw traduzirAuth(error);
    const novoNome = typeof data === "string" ? data : nome.trim();
    setUser((atual) => {
      if (!atual) return atual;
      const novo = { ...atual, farm: novoNome };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(novo));
      } catch {
        /* sem armazenamento */
      }
      return novo;
    });
  }, []);

  const listarMembros = useCallback(async (): Promise<Membro[]> => {
    const { data, error } = await supabase().rpc("listar_membros");
    if (error) throw traduzirAuth(error);
    return (Array.isArray(data) ? data : []) as Membro[];
  }, []);

  const removerMembro = useCallback(async (userId: string): Promise<void> => {
    const { error } = await supabase().rpc("remover_membro", { p_user_id: userId });
    if (error) throw traduzirAuth(error);
  }, []);

  const excluirConta = useCallback(
    async (senha: string): Promise<void> => {
      if (!user) throw new Error("Entre na sua conta primeiro.");
      const { error } = await supabase().auth.signInWithPassword({ email: user.email, password: senha });
      if (error) throw /invalid login credentials/i.test(error.message) ? new Error("A senha está incorreta.") : traduzirAuth(error);
      const { error: e2 } = await supabase().rpc("excluir_fazenda_e_conta");
      if (e2) throw traduzirAuth(e2);
      await supabase().auth.signOut({ scope: "local" }).catch(() => undefined);
      await limparDadosLocais();
      try {
        localStorage.setItem(AVISO_KEY, "Sua conta e os dados da fazenda foram excluídos.");
      } catch {
        /* sem armazenamento */
      }
      guardar(null);
    },
    [user, guardar]
  );

  const verificarVinculo = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase().rpc("minha_fazenda");
      if (error || !Array.isArray(data)) return true; // sem conexão ou erro: não decide nada
      if (data.length > 0) return true;
    } catch {
      return true;
    }
    // Resposta vazia e sem erro: a conta não faz mais parte da fazenda.
    await supabase().auth.signOut({ scope: "local" }).catch(() => undefined);
    await limparDadosLocais();
    try {
      localStorage.setItem(AVISO_KEY, "Você não faz mais parte desta fazenda (o dono removeu o acesso ou a fazenda foi excluída).");
    } catch {
      /* sem armazenamento */
    }
    guardar(null);
    return false;
  }, [guardar]);

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
      confirmarCodigo,
      reenviarCodigo,
      criarFazenda,
      entrarComCodigo,
      concluir,
      sessaoAberta,
      atualizarFazenda,
      logout,
      pedirCodigoSenha,
      redefinirSenha,
      trocarSenha,
      atualizarNome,
      renomearFazenda,
      listarMembros,
      removerMembro,
      excluirConta,
      verificarVinculo,
    }),
    [user, isLoading, entrar, criarConta, confirmarCodigo, reenviarCodigo, criarFazenda, entrarComCodigo, concluir, sessaoAberta, atualizarFazenda, logout, pedirCodigoSenha, redefinirSenha, trocarSenha, atualizarNome, renomearFazenda, listarMembros, removerMembro, excluirConta, verificarVinculo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
