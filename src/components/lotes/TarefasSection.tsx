"use client";

import { useState } from "react";
import { CheckSquare, Plus, Square, Trash, Warning } from "@phosphor-icons/react";
import { alternarTarefa, criarTarefa, excluirTarefa } from "@/lib/lotes";
import { diasParaVencer } from "@/lib/rotinas";
import { useTarefasDoLote } from "@/lib/hooks";
import { cn, hoje } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrazoBadge } from "@/components/ui/PrazoBadge";

export function TarefasSection({ loteId }: { loteId: string }) {
  const tarefas = useTarefasDoLote(loteId);
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setTitulo("");
    setObservacao("");
    setPrazo("");
    setErro("");
    setSalvando(false);
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await criarTarefa(loteId, { titulo, observacao, prazo });
      setAberto(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  const abertas = tarefas?.filter((t) => !t.feita) ?? [];
  const concluidas = tarefas?.filter((t) => t.feita) ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-dark">Tarefas</h2>
        <button type="button" onClick={abrir} className="btn-secondary min-h-10 px-4 text-sm">
          <Plus size={18} weight="bold" />
          Nova
        </button>
      </div>

      {tarefas && tarefas.length === 0 && (
        <div className="card text-sm text-dark/60">
          Anote o que este pasto precisa: arrumar a cerca, jogar adubo, roçar, jogar veneno...
        </div>
      )}

      <ul className="space-y-2">
        {[...abertas, ...concluidas].map((t) => {
          const dias = t.prazo && !t.feita ? diasParaVencer(t.prazo, hoje()) : null;
          return (
            <li key={t.id} className="card flex items-start gap-3 p-3">
              <button
                type="button"
                onClick={() => alternarTarefa(t.id)}
                aria-label={t.feita ? "Reabrir tarefa" : "Concluir tarefa"}
                className="mt-0.5 shrink-0 text-brand-700"
              >
                {t.feita ? (
                  <CheckSquare size={28} weight="fill" />
                ) : (
                  <Square size={28} className="text-dark/35" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-base font-semibold text-dark",
                    t.feita && "text-dark/45 line-through"
                  )}
                >
                  {t.titulo}
                </p>
                {t.observacao && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-dark/60">{t.observacao}</p>
                )}
                {dias !== null && <PrazoBadge dias={dias} className="mt-1.5" />}
              </div>
              <button
                type="button"
                onClick={() => excluirTarefa(t.id)}
                aria-label="Excluir tarefa"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dark/40 hover:bg-red-50 hover:text-red-600"
              >
                <Trash size={20} />
              </button>
            </li>
          );
        })}
      </ul>

      <BottomSheet
        open={aberto}
        onClose={() => setAberto(false)}
        title="Nova tarefa"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" form="form-tarefa" disabled={salvando} className="btn-primary flex-1">
              {salvando ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        }
      >
        <form id="form-tarefa" onSubmit={salvar} className="space-y-4 pt-1">
          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
            >
              <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
              {erro}
            </div>
          )}
          <div>
            <label htmlFor="tarefa-titulo" className="field-label">
              O que precisa ser feito? <span className="text-red-600">*</span>
            </label>
            <input
              id="tarefa-titulo"
              className="field"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Arrumar a cerca"
              autoComplete="off"
              list="tarefas-sugestoes"
              required
            />
            <datalist id="tarefas-sugestoes">
              {["Arrumar a cerca", "Jogar adubo", "Roçar o pasto", "Jogar veneno", "Limpar o bebedouro"].map(
                (s) => (
                  <option key={s} value={s} />
                )
              )}
            </datalist>
          </div>
          <div>
            <label htmlFor="tarefa-prazo" className="field-label">
              Prazo (opcional)
            </label>
            <input
              id="tarefa-prazo"
              type="date"
              className="field"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="tarefa-obs" className="field-label">
              Observação (opcional)
            </label>
            <textarea
              id="tarefa-obs"
              rows={3}
              className="field h-auto py-3"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes da tarefa"
            />
          </div>
        </form>
      </BottomSheet>
    </section>
  );
}
