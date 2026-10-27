"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowsLeftRight,
  Cow,
  PencilSimple,
  Plant,
  Syringe,
  Tag,
  Trash,
} from "@phosphor-icons/react";
import { descreverCabecas, totalCabecas } from "@/lib/composicao";
import { atualizarLoteGado, excluirLoteGado } from "@/lib/gado";
import { useLoteGado, usePasto } from "@/lib/hooks";
import type { LoteGado, LoteGadoInput } from "@/lib/types";
import { cn, formatDataBR, formatPeso } from "@/lib/utils";
import { CabecasSection } from "@/components/gado/CabecasSection";
import { PartosSection } from "@/components/gado/PartosSection";
import { LoteGadoFormSheet } from "@/components/gado/LoteGadoFormSheet";
import { DestinoPastoSheet } from "@/components/pastos/DestinoPastoSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Erro } from "@/components/ui/Erro";

function comoEntrada(l: LoteGado): LoteGadoInput {
  return {
    nome: l.nome,
    pastoId: l.pastoId,
    composicao: l.composicao,
    raca: l.raca,
    pesoMedioKg: l.pesoMedioKg,
    origem: l.origem,
    situacao: l.situacao,
    vacinas: l.vacinas,
    observacoes: l.observacoes,
  };
}

// Esta tela usa /lote?id=... (e não /lote/[id]) para a rota fixa poder ser guardada em cache
// e abrir sem internet para qualquer lote.
export default function LotePage() {
  const router = useRouter();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const lote = useLoteGado(id ?? null);
  const pasto = usePasto(lote?.pastoId ?? null);
  const [editando, setEditando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  if (id === undefined || lote === undefined) {
    return <p className="py-20 text-center text-sm text-dark/50">Carregando...</p>;
  }

  if (!lote) {
    return (
      <div className="px-4 pt-10 text-center">
        <p className="text-lg font-bold text-dark">Lote não encontrado</p>
        <p className="mt-1 text-sm text-dark/60">Ele pode ter sido excluído.</p>
        <Link prefetch={false} href="/gado" className="btn-primary mt-5 inline-flex">
          Voltar para o gado
        </Link>
      </div>
    );
  }

  const venda = lote.situacao === "Separado para venda";
  const total = totalCabecas(lote.composicao);

  async function alternarVenda() {
    if (!lote) return;
    setErro("");
    try {
      await atualizarLoteGado(lote.id, {
        ...comoEntrada(lote),
        situacao: venda ? "Normal" : "Separado para venda",
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  }

  async function confirmarExclusao() {
    if (!lote) return;
    await excluirLoteGado(lote.id);
    router.replace("/gado");
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link
            prefetch={false}
            href="/gado"
            aria-label="Voltar para o gado"
            className="flex h-10 w-10 items-center justify-center rounded-full text-dark/70 hover:bg-dark/5"
          >
            <ArrowLeft size={24} />
          </Link>
          <button type="button" onClick={() => setEditando(true)} className="btn-ghost min-h-10 px-3 text-sm">
            <PencilSimple size={18} />
            Editar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              venda ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700"
            )}
          >
            <Cow size={30} weight="duotone" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold leading-tight text-dark">{lote.nome}</h1>
            <p className="text-sm font-semibold text-brand-700">{descreverCabecas(total)}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4">
        <Erro texto={erro} />

        <section className="card space-y-3">
          <div className="flex items-center gap-3">
            <Plant size={22} className="shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-dark/55">Pasto onde está</p>
              {pasto ? (
                <Link prefetch={false} href={`/pasto?id=${pasto.id}`} className="block truncate font-bold text-brand-800">
                  {pasto.nome}
                </Link>
              ) : (
                <p className="font-bold text-dark">Sem pasto</p>
              )}
            </div>
            <button type="button" onClick={() => setMovendo(true)} className="btn-secondary min-h-10 px-3 text-sm">
              <ArrowsLeftRight size={18} />
              Mover
            </button>
          </div>
          <button
            type="button"
            onClick={alternarVenda}
            className={cn("w-full text-sm", venda ? "btn-secondary min-h-11" : "btn-secondary min-h-11")}
          >
            <Tag size={18} />
            {venda ? "Tirar da lista de venda" : "Separar para venda"}
          </button>
          {venda && (
            <p className="text-xs text-amber-800">
              Este lote está separado para venda. O registro da venda chega junto com a aba Finanças.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold text-dark">Composição</h2>
          <ul className="card divide-y divide-brand-100 p-0">
            {lote.composicao.map((l) => (
              <li key={`${l.sexo}-${l.categoria}`} className="flex items-center justify-between px-4 py-3">
                <span className="text-dark">
                  {l.categoria} <span className="text-sm text-dark/50">({l.sexo === "Fêmea" ? "fêmea" : "macho"})</span>
                </span>
                <span className="font-bold text-dark">{l.quantidade}</span>
              </li>
            ))}
            <li className="flex items-center justify-between bg-brand-50/60 px-4 py-3 font-bold">
              <span>Total</span>
              <span className="text-brand-700">{total}</span>
            </li>
          </ul>
        </section>

        {(lote.raca || lote.pesoMedioKg !== null || lote.origem || lote.observacoes) && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-dark">Características</h2>
            <dl className="card space-y-2 text-sm">
              {lote.raca && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dark/60">Raça</dt>
                  <dd className="font-semibold text-dark">{lote.raca}</dd>
                </div>
              )}
              {lote.pesoMedioKg !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dark/60">Peso médio</dt>
                  <dd className="font-semibold text-dark">{formatPeso(lote.pesoMedioKg)}</dd>
                </div>
              )}
              {lote.origem && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dark/60">Origem</dt>
                  <dd className="font-semibold text-dark">{lote.origem}</dd>
                </div>
              )}
              {lote.observacoes && (
                <div>
                  <dt className="text-dark/60">Observações</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-dark">{lote.observacoes}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold text-dark">Vacinas</h2>
          {lote.vacinas.length === 0 ? (
            <div className="card text-sm text-dark/60">
              Nenhuma vacina anotada. Use <strong>Editar</strong> para registrar as vacinas do lote (opcional).
            </div>
          ) : (
            <ul className="space-y-2">
              {lote.vacinas.map((v, i) => (
                <li key={i} className="card flex items-center gap-3 p-3">
                  <Syringe size={22} className={v.aplicada ? "text-brand-700" : "text-amber-600"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-dark">{v.nome}</p>
                    <p className="text-sm text-dark/60">
                      {v.aplicada
                        ? `Aplicada${v.data ? ` em ${formatDataBR(v.data)}` : ""}`
                        : "Não aplicada"}
                    </p>
                  </div>
                  {v.aplicada && v.faltam ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Faltam {v.faltam}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <PartosSection lote={lote} />

        <CabecasSection lote={lote} />

        <button
          type="button"
          onClick={() => setExcluindo(true)}
          className="btn w-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
        >
          <Trash size={20} />
          Excluir lote
        </button>
      </div>

      <LoteGadoFormSheet open={editando} lote={lote} onClose={() => setEditando(false)} />
      <DestinoPastoSheet open={movendo} lote={lote} onClose={() => setMovendo(false)} />
      <ConfirmSheet
        open={excluindo}
        title="Excluir lote?"
        confirmLabel="Excluir"
        onConfirm={confirmarExclusao}
        onClose={() => setExcluindo(false)}
      >
        <p>
          O lote <strong>{lote.nome}</strong> ({descreverCabecas(total)}) será removido, junto com as cabeças
          cadastradas nele.
        </p>
      </ConfirmSheet>
    </div>
  );
}
