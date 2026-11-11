import { db } from "./db";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Sincronização com a nuvem (Supabase).
//
// Regras:
//  - Tudo continua sendo gravado primeiro no aparelho (funciona sem internet).
//  - Registros "pending" são enviados; depois baixamos o que outros aparelhos mudaram.
//  - Conflito: vale o que foi salvo por último (updatedAt). Registro excluído não volta.
// ---------------------------------------------------------------------------

export const TABELAS_SYNC = [
  "pastos",
  "lotesGado",
  "cabecas",
  "tarefas",
  "notas",
  "partos",
  "recursos",
  "comprasRecurso",
  "usosRecurso",
  "movimentacoes",
] as const;
export type TabelaSync = (typeof TABELAS_SYNC)[number];

export interface RegistroNuvem {
  tabela: string;
  id: string;
  dados: Record<string, unknown>;
  atualizadoEm: string;
  servidorEm?: string;
}

/** O que a sincronização precisa do servidor (assim dá para testar sem internet). */
export interface Remoto {
  enviar(registros: RegistroNuvem[]): Promise<void>;
  buscar(desde: string | null, limite: number): Promise<RegistroNuvem[]>;
}

export const LOTE_ENVIO = 200;
export const LOTE_BUSCA = 500;
const SOBREPOSICAO_MS = 2000;

const CHAVE_FAZENDA = "cownter.sync.fazenda";
const chaveCursor = (fazenda: string) => `cownter.sync.cursor.${fazenda}`;

// ---------------------------------------------------------------------------
// Estado visível na tela (Perfil)
// ---------------------------------------------------------------------------

export interface EstadoSync {
  rodando: boolean;
  ultima: string | null;
  erro: string | null;
}

let estado: EstadoSync = { rodando: false, ultima: null, erro: null };
const ouvintes = new Set<() => void>();

function mudar(parcial: Partial<EstadoSync>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => f());
}
export const estadoSync = () => estado;
export function assinarEstadoSync(f: () => void): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

// ---------------------------------------------------------------------------
// Aparelho x fazenda
// ---------------------------------------------------------------------------

export function fazendaDoAparelho(): string | null {
  try {
    return localStorage.getItem(CHAVE_FAZENDA);
  } catch {
    return null;
  }
}

export async function contarRegistrosLocais(): Promise<number> {
  let total = 0;
  for (const t of TABELAS_SYNC) total += await db.table(t).count();
  return total;
}

/** Apaga todos os dados locais (tabelas e marcas de sincronização). */
export async function limparDadosLocais(): Promise<void> {
  await db.transaction("rw", TABELAS_SYNC.map((t) => db.table(t)), async () => {
    for (const t of TABELAS_SYNC) await db.table(t).clear();
  });
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("cownter.sync.")) localStorage.removeItem(k);
    }
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}

/**
 * Liga este aparelho a uma fazenda. Se o aparelho tinha dados de outra fazenda (ou de teste,
 * sem fazenda), eles são apagados antes: a fazenda nova começa só com o que está na nuvem.
 */
export async function prepararAparelho(fazendaId: string): Promise<void> {
  if (fazendaDoAparelho() !== fazendaId) {
    await limparDadosLocais();
    localStorage.setItem(CHAVE_FAZENDA, fazendaId);
  }
}

// ---------------------------------------------------------------------------
// Enviar e baixar
// ---------------------------------------------------------------------------

function paraNuvem(tabela: string, linha: Record<string, unknown>): RegistroNuvem {
  const { syncStatus: _s, ...dados } = linha;
  void _s;
  return { tabela, id: String(linha.id), dados, atualizadoEm: String(linha.updatedAt) };
}

export async function enviarPendentes(remoto: Remoto): Promise<number> {
  let enviados = 0;
  for (const tabela of TABELAS_SYNC) {
    const pendentes = (await db.table(tabela).where("syncStatus").equals("pending").toArray()) as Record<string, unknown>[];
    for (let i = 0; i < pendentes.length; i += LOTE_ENVIO) {
      const grupo = pendentes.slice(i, i + LOTE_ENVIO);
      await remoto.enviar(grupo.map((l) => paraNuvem(tabela, l)));
      // Só marca como enviado o que não mudou durante o envio.
      for (const l of grupo) {
        await db.table(tabela).where("id").equals(l.id as string).modify((atual: Record<string, unknown>) => {
          if (atual.updatedAt === l.updatedAt) atual.syncStatus = "synced";
        });
      }
      enviados += grupo.length;
    }
  }
  return enviados;
}

export async function baixarMudancas(remoto: Remoto, fazendaId: string): Promise<number> {
  let cursor = (() => {
    try {
      return localStorage.getItem(chaveCursor(fazendaId));
    } catch {
      return null;
    }
  })();
  if (cursor) cursor = new Date(Date.parse(cursor) - SOBREPOSICAO_MS).toISOString();

  let aplicados = 0;
  for (;;) {
    const lote = await remoto.buscar(cursor, LOTE_BUSCA);
    if (lote.length === 0) break;
    for (const r of lote) {
      if (!(TABELAS_SYNC as readonly string[]).includes(r.tabela)) continue;
      const tabela = db.table(r.tabela);
      const local = (await tabela.get(r.id)) as Record<string, unknown> | undefined;
      const remotoMaisNovo = !local || String(r.dados.updatedAt) > String(local.updatedAt);
      const localJaEnviado = local?.syncStatus === "synced";
      // Um registro excluído na nuvem nunca é "desexcluído" por uma cópia local ainda pendente.
      const excluidoRemoto = r.dados.deletedAt != null && local?.deletedAt == null;
      if (remotoMaisNovo || localJaEnviado || excluidoRemoto) {
        await tabela.put({ ...r.dados, syncStatus: "synced" });
        aplicados++;
      }
    }
    const ultimo = lote[lote.length - 1].servidorEm;
    if (ultimo) {
      cursor = ultimo;
      try {
        localStorage.setItem(chaveCursor(fazendaId), ultimo);
      } catch {
        /* sem armazenamento: baixa tudo de novo na próxima vez */
      }
    }
    if (lote.length < LOTE_BUSCA) break;
  }
  return aplicados;
}

let emAndamento: Promise<void> | null = null;

/** Envia e depois baixa. Só uma sincronização roda por vez. */
export function sincronizar(fazendaId: string, remoto: Remoto = remotoSupabase()): Promise<void> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    mudar({ rodando: true, erro: null });
    try {
      await enviarPendentes(remoto);
      await baixarMudancas(remoto, fazendaId);
      mudar({ rodando: false, ultima: new Date().toISOString(), erro: null });
    } catch (e) {
      mudar({ rodando: false, erro: traduzirErro(e) });
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

export function traduzirErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/failed to fetch|network|fetch failed|load failed/i.test(msg)) return "Sem conexão com o servidor. Tentamos de novo quando a internet voltar.";
  if (/jwt|not authenticated|invalid refresh|refresh token|entre na sua conta/i.test(msg)) return "Sua sessão expirou. Saia e entre de novo para sincronizar.";
  return msg || "Não foi possível sincronizar.";
}

// ---------------------------------------------------------------------------
// Servidor real (Supabase)
// ---------------------------------------------------------------------------

export function remotoSupabase(): Remoto {
  return {
    async enviar(registros) {
      const { error } = await supabase().rpc("enviar_registros", {
        p_registros: registros.map((r) => ({ tabela: r.tabela, id: r.id, dados: r.dados, atualizado_em: r.atualizadoEm })),
      });
      if (error) throw error;
    },
    async buscar(desde, limite) {
      let q = supabase().from("registros").select("tabela,id,dados,atualizado_em,servidor_em").order("servidor_em", { ascending: true }).limit(limite);
      if (desde) q = q.gt("servidor_em", desde);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tabela: r.tabela as string,
        id: r.id as string,
        dados: r.dados as Record<string, unknown>,
        atualizadoEm: r.atualizado_em as string,
        servidorEm: r.servidor_em as string,
      }));
    },
  };
}
