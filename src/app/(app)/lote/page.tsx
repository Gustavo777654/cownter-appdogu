"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Moon, PencilSimple, Plant, Trash, Warning } from "@phosphor-icons/react";
import { alterarSituacao, atualizarNivel, excluirLote } from "@/lib/lotes";
import { useLote } from "@/lib/hooks";
import { NIVEIS_PASTO } from "@/lib/types";
import { cn, formatDesde } from "@/lib/utils";
import { Segmented } from "@/components/ui/Segmented";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { AnimaisDoLote } from "@/components/lotes/AnimaisDoLote";
import { LoteFormSheet } from "@/components/lotes/LoteFormSheet";
import { NotasSection } from "@/components/lotes/NotasSection";
import { RotinaCard } from "@/components/lotes/RotinaCard";
import { TarefasSection } from "@/components/lotes/TarefasSection";
import { COR_NIVEL_SELECIONADO } from "@/components/lotes/nivel";

// Esta tela usa /lote?id=... em vez de /lotes/[id] de propósito: uma rota fixa pode
// ser guardada em cache e abrir sem internet para qualquer pasto.
export default function LotePage() {
  const router = useRouter();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const lote = useLote(id ?? null);
  const [editando, setEditando] = useState(false);
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
        <p className="text-lg font-bold text-dark">Pasto não encontrado</p>
        <p className="mt-1 text-sm text-dark/60">Ele pode ter sido excluído.</p>
        <Link prefetch={false} href="/lotes" className="btn-primary mt-5 inline-flex">
          Voltar para os lotes
        </Link>
      </div>
    );
  }

  const reservado = lote.situacao === "Reservado";

  async function trocarSituacao() {
    if (!lote) return;
    setErro("");
    try {
      await alterarSituacao(lote.id, reservado ? "Em uso" : "Reservado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  }

  async function confirmarExclusao() {
    if (!lote) return;
    await excluirLote(lote.id);
    router.replace("/lotes");
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link prefetch={false}
            href="/lotes"
            aria-label="Voltar para os lotes"
            className="flex h-10 w-10 items-center justify-center rounded-full text-dark/70 hover:bg-dark/5"
          >
            <ArrowLeft size={24} />
          </Link>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="btn-ghost min-h-10 px-3 text-sm"
          >
            <PencilSimple size={18} />
            Editar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              reservado ? "bg-earth-100 text-earth-700" : "bg-brand-100 text-brand-700"
            )}
          >
            {reservado ? <Moon size={30} weight="duotone" /> : <Plant size={30} weight="duotone" />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold leading-tight text-dark">{lote.nome}</h1>
            {lote.areaHa !== null && (
              <p className="text-sm text-dark/60">{lote.areaHa.toLocaleString("pt-BR")} hectares</p>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4">
        <section className="card space-y-4">
          <div>
            <Segmented
              label="Nível do pasto (capim)"
              value={lote.nivelPasto}
              options={NIVEIS_PASTO}
              onChange={(n) => atualizarNivel(lote.id, n)}
              cores={COR_NIVEL_SELECIONADO}
            />
            <p className="mt-1.5 text-xs text-dark/55">
              Atualizado {formatDesde(lote.nivelEm)}.
            </p>
          </div>

          <div className="border-t border-brand-100 pt-4">
            {erro && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
              >
                <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
                {erro}
              </div>
            )}
            <p className="text-sm text-dark/70">
              {reservado ? "Reservado (descansando)" : "Em uso"}{" "}
              <strong className="text-dark">{formatDesde(lote.situacaoDesde)}</strong>
            </p>
            <button
              type="button"
              onClick={trocarSituacao}
              className={cn("mt-2 w-full", reservado ? "btn-primary" : "btn-secondary")}
            >
              {reservado ? "Liberar para uso" : "Reservar para descanso"}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-dark">Rotinas</h2>
          <RotinaCard lote={lote} tipo="remedio" />
          <RotinaCard lote={lote} tipo="sal" />
        </section>

        <AnimaisDoLote lote={lote} />
        <TarefasSection loteId={lote.id} />
        <NotasSection loteId={lote.id} />

        <button
          type="button"
          onClick={() => setExcluindo(true)}
          className="btn w-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
        >
          <Trash size={20} />
          Excluir pasto
        </button>
      </div>

      <LoteFormSheet open={editando} lote={lote} onClose={() => setEditando(false)} />
      <ConfirmSheet
        open={excluindo}
        title="Excluir pasto?"
        confirmLabel="Excluir"
        onConfirm={confirmarExclusao}
        onClose={() => setExcluindo(false)}
      >
        <p>
          O pasto <strong>{lote.nome}</strong> será removido, junto com as tarefas e observações dele.
          Os animais que estão nele ficam sem pasto.
        </p>
      </ConfirmSheet>
    </div>
  );
}
