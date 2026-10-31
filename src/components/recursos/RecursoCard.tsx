"use client";

import { useState } from "react";
import { PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { consumoMedio, diasDeEstoque } from "@/lib/estoque";
import { useHistoricoRecurso } from "@/lib/hooks";
import { excluirRecurso, formatarQuantidade, formatarReais, formatarUnidades } from "@/lib/recursos";
import type { Recurso, UsoRecurso } from "@/lib/types";
import { formatDataBR, hoje } from "@/lib/utils";
import { RecursoFormSheet } from "./RecursoFormSheet";
import { ReporSheet } from "./ReporSheet";

export function RecursoCard({ recurso, usos }: { recurso: Recurso; usos: UsoRecurso[] }) {
  const [editando, setEditando] = useState(false);
  const [repondo, setRepondo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const historico = useHistoricoRecurso(recurso.id);

  const baixo = recurso.estoque <= 0 || (recurso.estoqueMinimo !== null && recurso.estoque <= recurso.estoqueMinimo);
  const consumo = consumoMedio(recurso.id, usos, hoje());
  const dias = diasDeEstoque(recurso.estoque, consumo);
  const suplemento = recurso.tipo === "Suplemento";

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-dark">{recurso.nome}</p>
          <p className="text-sm text-dark/60">
            {suplemento && recurso.kgPorSaco ? `Saco de ${formatarQuantidade(recurso.kgPorSaco)} kg` : "Remédio"}
            {recurso.precoUnitario !== null && ` · ${formatarReais(recurso.precoUnitario)} cada`}
          </p>
        </div>
        {baixo && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
            <WarningCircle size={14} weight="fill" />
            {recurso.estoque <= 0 ? "Acabou" : "Estoque baixo"}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-brand-50 p-3">
        <p className="text-2xl font-bold text-dark">{formatarUnidades(recurso.estoque, recurso.tipo)}</p>
        <p className="text-sm text-dark/60">
          {suplemento && recurso.kgPorSaco ? `${formatarQuantidade(recurso.estoque * recurso.kgPorSaco)} kg em estoque` : "em estoque"}
          {recurso.estoqueMinimo !== null && ` · aviso em ${formatarQuantidade(recurso.estoqueMinimo)}`}
        </p>
        {consumo && (
          <p className="mt-1 text-sm text-dark/70">
            Consumo médio: {formatarQuantidade(Math.round(consumo.porDia * 30 * 100) / 100)} {recurso.tipo === "Suplemento" ? "sacos" : "frascos"} por mês
            {dias !== null && ` · dura cerca de ${dias} ${dias === 1 ? "dia" : "dias"}`}
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setRepondo(true)} className="btn-primary min-h-11 flex-1 px-3 text-sm">
          <Plus size={18} weight="bold" />
          Repor estoque
        </button>
        <button type="button" onClick={() => setEditando(true)} className="btn-secondary min-h-11 px-3 text-sm" aria-label={`Editar ${recurso.nome}`}>
          <PencilSimple size={18} />
        </button>
        <button type="button" onClick={() => setExcluindo(true)} className="btn-secondary min-h-11 px-3 text-sm text-red-600" aria-label={`Excluir ${recurso.nome}`}>
          <Trash size={18} />
        </button>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer select-none text-sm font-semibold text-brand-800">
          Histórico ({(historico?.compras.length ?? 0) + (historico?.usos.length ?? 0)})
        </summary>
        <ul className="mt-2 space-y-1.5 text-sm">
          {[
            ...(historico?.compras ?? []).map((c) => ({
              chave: c.id,
              data: c.data,
              criado: c.createdAt,
              texto: `Compra: +${formatarUnidades(c.quantidade, recurso.tipo)}${c.total !== null ? ` (${formatarReais(c.total)})` : ""}`,
            })),
            ...(historico?.usos ?? []).map((u) => ({
              chave: u.id,
              data: u.data,
              criado: u.createdAt,
              texto: `Uso (${u.rotina === "sal" ? "sal" : "remédio"}): −${formatarUnidades(u.quantidade, recurso.tipo)}`,
            })),
          ]
            .sort((a, b) => b.data.localeCompare(a.data) || b.criado.localeCompare(a.criado))
            .map((h) => (
              <li key={h.chave} className="flex justify-between gap-3 text-dark/80">
                <span>{h.texto}</span>
                <span className="shrink-0 text-dark/50">{formatDataBR(h.data)}</span>
              </li>
            ))}
          {historico && historico.compras.length + historico.usos.length === 0 && (
            <li className="text-dark/50">Nada registrado ainda.</li>
          )}
        </ul>
      </details>

      <RecursoFormSheet open={editando} tipo={recurso.tipo} recurso={recurso} onClose={() => setEditando(false)} />
      <ReporSheet open={repondo} recurso={recurso} onClose={() => setRepondo(false)} />
      <ConfirmSheet
        open={excluindo}
        title="Excluir do estoque?"
        confirmLabel="Excluir"
        onConfirm={async () => {
          await excluirRecurso(recurso.id);
        }}
        onClose={() => setExcluindo(false)}
      >
        <p>
          <strong>{recurso.nome}</strong> sai da lista de estoque. O histórico de compras e usos continua guardado.
        </p>
      </ConfirmSheet>
    </div>
  );
}
