"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { lerConfiguracao, type Configuracao } from "./config";
import { db } from "./db";
import type { Cabeca, CompraRecurso, LoteGado, Nota, Parto, Pasto, Recurso, Tarefa, TipoRecurso, UsoRecurso } from "./types";

const ordenarTexto = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true });

/** Pastos ativos, em ordem alfabética. */
export function usePastos(): Pasto[] | undefined {
  return useLiveQuery(async () => {
    const todos = await db.pastos.filter((p) => !p.deletedAt).toArray();
    return todos.sort((a, b) => ordenarTexto(a.nome, b.nome));
  }, []);
}

/** Um pasto: undefined = carregando, null = não existe (ou foi excluído). */
export function usePasto(id: string | null): Pasto | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const pasto = await db.pastos.get(id);
    return pasto && !pasto.deletedAt ? pasto : null;
  }, [id]);
}

/**
 * Lotes de gado ativos, em ordem alfabética.
 * Retorna undefined enquanto o banco local ainda está carregando.
 * A lista se atualiza sozinha quando qualquer tela grava no banco.
 */
export function useLotesGado(): LoteGado[] | undefined {
  return useLiveQuery(async () => {
    const todos = await db.lotesGado.filter((l) => !l.deletedAt).toArray();
    return todos.sort((a, b) => ordenarTexto(a.nome, b.nome));
  }, []);
}

/** Um lote de gado: undefined = carregando, null = não existe (ou foi excluído). */
export function useLoteGado(id: string | null): LoteGado | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const lote = await db.lotesGado.get(id);
    return lote && !lote.deletedAt ? lote : null;
  }, [id]);
}

/** Cabeças cadastradas uma a uma dentro de um lote. */
export function useCabecas(loteGadoId: string | null): Cabeca[] | undefined {
  return useLiveQuery(async () => {
    if (!loteGadoId) return [];
    const todas = await db.cabecas
      .where("loteGadoId")
      .equals(loteGadoId)
      .filter((c) => !c.deletedAt)
      .toArray();
    return todas.sort((a, b) =>
      ordenarTexto(a.brinco || a.nome || a.cor, b.brinco || b.nome || b.cor)
    );
  }, [loteGadoId]);
}

/** Tarefas de um pasto: abertas primeiro (por prazo), concluídas depois. */
export function useTarefasDoPasto(pastoId: string | null): Tarefa[] | undefined {
  return useLiveQuery(async () => {
    if (!pastoId) return [];
    const todas = await db.tarefas
      .where("pastoId")
      .equals(pastoId)
      .filter((t) => !t.deletedAt)
      .toArray();
    return todas.sort((a, b) => {
      if (a.feita !== b.feita) return a.feita ? 1 : -1;
      if (!a.feita) {
        if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
        if (a.prazo || b.prazo) return a.prazo ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      }
      return (b.feitaEm ?? "").localeCompare(a.feitaEm ?? "");
    });
  }, [pastoId]);
}

/** Todas as tarefas abertas de todos os pastos (para os alertas da tela inicial). */
export function useTarefasAbertas(): Tarefa[] | undefined {
  return useLiveQuery(
    () => db.tarefas.filter((t) => !t.deletedAt && !t.feita).toArray(),
    []
  );
}

/** Partos de um lote (mais recentes primeiro). */
export function usePartosDoLote(loteGadoId: string | null): Parto[] | undefined {
  return useLiveQuery(async () => {
    if (!loteGadoId) return [];
    const todos = await db.partos
      .where("loteGadoId")
      .equals(loteGadoId)
      .filter((p) => !p.deletedAt)
      .toArray();
    return todos.sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt));
  }, [loteGadoId]);
}

/** Partos ainda não desmamados de todos os lotes (para o aviso de desmama no Início). */
export function usePartosAbertos(): Parto[] | undefined {
  return useLiveQuery(() => db.partos.filter((p) => !p.deletedAt && !p.desmamado).toArray(), []);
}

/** Observações de um pasto, da mais recente para a mais antiga. */
export function useNotasDoPasto(pastoId: string | null): Nota[] | undefined {
  return useLiveQuery(async () => {
    if (!pastoId) return [];
    const todas = await db.notas
      .where("pastoId")
      .equals(pastoId)
      .filter((n) => !n.deletedAt)
      .toArray();
    return todas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [pastoId]);
}

/** Quantidade de registros (inclusive exclusões) que ainda não foram sincronizados. */
export function usePendentesSync(): number | undefined {
  return useLiveQuery(async () => {
    const contagens = await Promise.all([
      db.pastos.where("syncStatus").equals("pending").count(),
      db.lotesGado.where("syncStatus").equals("pending").count(),
      db.cabecas.where("syncStatus").equals("pending").count(),
      db.tarefas.where("syncStatus").equals("pending").count(),
      db.notas.where("syncStatus").equals("pending").count(),
      db.partos.where("syncStatus").equals("pending").count(),
      db.recursos.where("syncStatus").equals("pending").count(),
      db.comprasRecurso.where("syncStatus").equals("pending").count(),
      db.usosRecurso.where("syncStatus").equals("pending").count(),
    ]);
    return contagens.reduce((soma, n) => soma + n, 0);
  }, []);
}

/** Estado da conexão do aparelho. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

/** Configurações do produtor (guardadas no aparelho). Lidas ao abrir a tela. */
export function useConfiguracao(): Configuracao | undefined {
  const [cfg, setCfg] = useState<Configuracao | undefined>(undefined);
  useEffect(() => setCfg(lerConfiguracao()), []);
  return cfg;
}

/** Itens do estoque (suplementos e remédios), em ordem alfabética. */
export function useRecursos(tipo?: TipoRecurso): Recurso[] | undefined {
  return useLiveQuery(async () => {
    const todos = await db.recursos.filter((r) => !r.deletedAt && (!tipo || r.tipo === tipo)).toArray();
    return todos.sort((a, b) => ordenarTexto(a.nome, b.nome));
  }, [tipo]);
}

/** Todos os usos de estoque (para calcular o consumo médio). */
export function useUsosRecurso(): UsoRecurso[] | undefined {
  return useLiveQuery(() => db.usosRecurso.filter((u) => !u.deletedAt).toArray(), []);
}

/** Histórico de um item: compras e usos, do mais recente para o mais antigo. */
export function useHistoricoRecurso(id: string): { compras: CompraRecurso[]; usos: UsoRecurso[] } | undefined {
  return useLiveQuery(async () => {
    const compras = await db.comprasRecurso.where("recursoId").equals(id).filter((c) => !c.deletedAt).toArray();
    const usos = await db.usosRecurso.where("recursoId").equals(id).filter((u) => !u.deletedAt).toArray();
    compras.sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt));
    usos.sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt));
    return { compras, usos };
  }, [id]);
}
