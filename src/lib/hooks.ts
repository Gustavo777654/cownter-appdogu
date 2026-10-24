"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Animal, Lote, Nota, Tarefa } from "./types";

const ordenarTexto = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true });

/**
 * Animais ativos (não excluídos), em ordem alfabética.
 * Retorna undefined enquanto o banco local ainda está carregando.
 * A lista se atualiza sozinha quando qualquer tela grava no banco.
 */
export function useAnimais(): Animal[] | undefined {
  return useLiveQuery(async () => {
    const todos = await db.animals.filter((a) => !a.deletedAt).toArray();
    return todos.sort((a, b) => ordenarTexto(a.nome || a.brinco, b.nome || b.brinco));
  }, []);
}

/** Pastos ativos, em ordem alfabética. */
export function useLotes(): Lote[] | undefined {
  return useLiveQuery(async () => {
    const todos = await db.lotes.filter((l) => !l.deletedAt).toArray();
    return todos.sort((a, b) => ordenarTexto(a.nome, b.nome));
  }, []);
}

/** Um pasto: undefined = carregando, null = não existe (ou foi excluído). */
export function useLote(id: string | null): Lote | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const lote = await db.lotes.get(id);
    return lote && !lote.deletedAt ? lote : null;
  }, [id]);
}

/** Tarefas de um pasto: abertas primeiro (por prazo), concluídas depois. */
export function useTarefasDoLote(loteId: string | null): Tarefa[] | undefined {
  return useLiveQuery(async () => {
    if (!loteId) return [];
    const todas = await db.tarefas
      .where("loteId")
      .equals(loteId)
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
  }, [loteId]);
}

/** Todas as tarefas abertas de todos os pastos (para os alertas da tela inicial). */
export function useTarefasAbertas(): Tarefa[] | undefined {
  return useLiveQuery(
    () => db.tarefas.filter((t) => !t.deletedAt && !t.feita).toArray(),
    []
  );
}

/** Observações de um pasto, da mais recente para a mais antiga. */
export function useNotasDoLote(loteId: string | null): Nota[] | undefined {
  return useLiveQuery(async () => {
    if (!loteId) return [];
    const todas = await db.notas
      .where("loteId")
      .equals(loteId)
      .filter((n) => !n.deletedAt)
      .toArray();
    return todas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [loteId]);
}

/** Quantidade de registros (inclusive exclusões) que ainda não foram sincronizados. */
export function usePendentesSync(): number | undefined {
  return useLiveQuery(async () => {
    const contagens = await Promise.all([
      db.animals.where("syncStatus").equals("pending").count(),
      db.lotes.where("syncStatus").equals("pending").count(),
      db.tarefas.where("syncStatus").equals("pending").count(),
      db.notas.where("syncStatus").equals("pending").count(),
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
