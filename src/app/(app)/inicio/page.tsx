"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BellRinging,
  CaretRight,
  CheckSquare,
  Cow,
  Drop,
  Moon,
  Pill,
  Plant,
  Plus,
  Tag,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { descreverCabecas, totalDeLotes } from "@/lib/composicao";
import { useLotesGado, usePastos, useTarefasAbertas } from "@/lib/hooks";
import { coletarAlertas, type Alerta } from "@/lib/rotinas";
import { hoje } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrazoBadge } from "@/components/ui/PrazoBadge";
import { LoteGadoCard } from "@/components/gado/LoteGadoCard";

function Indicador({
  rotulo,
  valor,
  Icone,
  cor,
}: {
  rotulo: string;
  valor: number | undefined;
  Icone: Icon;
  cor: string;
}) {
  return (
    <div className="card">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${cor}`}>
        <Icone size={22} weight="duotone" />
      </div>
      <p className="text-3xl font-bold text-dark">{valor ?? "–"}</p>
      <p className="text-sm text-dark/60">{rotulo}</p>
    </div>
  );
}

const ICONE_ALERTA: Record<Alerta["tipo"], Icon> = {
  remedio: Pill,
  sal: Drop,
  tarefa: CheckSquare,
};

export default function InicioPage() {
  const { user } = useAuth();
  const lotes = useLotesGado();
  const pastos = usePastos();
  const tarefas = useTarefasAbertas();

  const cabecas = lotes ? totalDeLotes(lotes) : undefined;
  const pastosEmUso = pastos?.filter((p) => p.situacao === "Em uso").length;
  const pastosDescansando = pastos?.filter((p) => p.situacao === "Reservado").length;
  const paraVenda = lotes?.filter((l) => l.situacao === "Separado para venda") ?? [];
  const nomesPastos = useMemo(() => new Map((pastos ?? []).map((p) => [p.id, p.nome])), [pastos]);

  const alertas = useMemo(
    () => (pastos && tarefas ? coletarAlertas(pastos, tarefas, hoje()) : undefined),
    [pastos, tarefas]
  );
  const atrasados = alertas?.filter((a) => a.dias < 0).length ?? 0;

  const primeiroNome = user?.name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome}`} subtitle={user?.farm} />

      <div className="space-y-6 px-4">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-dark">Para fazer</h2>
            {atrasados > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                {atrasados} {atrasados === 1 ? "atrasada" : "atrasadas"}
              </span>
            )}
          </div>

          {alertas && alertas.length === 0 ? (
            <div className="card flex items-start gap-3 text-sm text-dark/60">
              <BellRinging size={22} className="mt-0.5 shrink-0 text-brand-700" />
              <p>
                {pastos && pastos.length === 0
                  ? "Crie seus pastos na aba Pastos e configure o remédio e o sal para o app avisar na hora certa."
                  : "Nada atrasado nem previsto para os próximos 7 dias."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alertas?.map((a) => {
                const Icone = ICONE_ALERTA[a.tipo];
                return (
                  <li key={a.chave}>
                    <Link prefetch={false} href={`/pasto?id=${a.pastoId}`} className="card flex items-center gap-3 p-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          a.dias < 0 ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        <Icone size={22} weight="duotone" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-dark">{a.titulo}</p>
                        <p className="truncate text-sm text-dark/60">{a.pastoNome}</p>
                      </div>
                      <PrazoBadge dias={a.dias} />
                      <CaretRight size={18} className="shrink-0 text-dark/30" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Indicador
            rotulo={cabecas === 1 ? "Cabeça de gado" : "Cabeças de gado"}
            valor={cabecas}
            Icone={Cow}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo={lotes?.length === 1 ? "Lote de gado" : "Lotes de gado"}
            valor={lotes?.length}
            Icone={Tag}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo="Pastos em uso"
            valor={pastosEmUso}
            Icone={Plant}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo="Pastos descansando"
            valor={pastosDescansando}
            Icone={Moon}
            cor="bg-earth-100 text-earth-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link prefetch={false} href="/gado?novo=1" className="btn-primary px-3 text-sm">
            <Plus size={20} weight="bold" />
            Cadastrar lote
          </Link>
          <Link prefetch={false} href="/pastos?novo=1" className="btn-secondary px-3 text-sm">
            <Plus size={20} weight="bold" />
            Criar pasto
          </Link>
        </div>

        {paraVenda.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-dark">Separados para venda</h2>
            <ul className="space-y-2">
              {paraVenda.map((l) => (
                <li key={l.id}>
                  <LoteGadoCard lote={l} pastoNome={l.pastoId ? (nomesPastos.get(l.pastoId) ?? null) : null} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {lotes && lotes.length === 0 && (
          <div className="card text-sm text-dark/60">
            Cadastre seus lotes de gado na aba Gado para ver aqui o total de cabeças ({descreverCabecas(0)} por enquanto).
          </div>
        )}
      </div>
    </>
  );
}
