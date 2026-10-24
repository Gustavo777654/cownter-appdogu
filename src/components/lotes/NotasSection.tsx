"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { criarNota, excluirNota } from "@/lib/lotes";
import { useNotasDoLote } from "@/lib/hooks";
import { formatDataBR } from "@/lib/utils";

export function NotasSection({ loteId }: { loteId: string }) {
  const notas = useNotasDoLote(loteId);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await criarNota(loteId, texto);
      setTexto("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-dark">Observações</h2>

      <form onSubmit={adicionar} className="mb-3 space-y-2">
        <textarea
          rows={2}
          className="field h-auto py-3"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma observação sobre este pasto"
          aria-label="Nova observação"
        />
        <button type="submit" disabled={salvando || !texto.trim()} className="btn-primary w-full">
          Salvar observação
        </button>
      </form>

      {notas && notas.length === 0 && (
        <p className="text-sm text-dark/50">Nenhuma observação ainda.</p>
      )}

      <ul className="space-y-2">
        {notas?.map((n) => (
          <li key={n.id} className="card flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-brand-700">{formatDataBR(n.data)}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-dark">{n.texto}</p>
            </div>
            <button
              type="button"
              onClick={() => excluirNota(n.id)}
              aria-label="Excluir observação"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dark/40 hover:bg-red-50 hover:text-red-600"
            >
              <Trash size={20} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
