"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BellRinging,
  CaretRight,
  CheckSquare,
  Cow,
  Drop,
  Heartbeat,
  Pill,
  Plant,
  Plus,
  Stethoscope,
  Syringe,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { useAnimais, useLotes, useTarefasAbertas } from "@/lib/hooks";
import { coletarAlertas, type Alerta } from "@/lib/rotinas";
import { hoje } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrazoBadge } from "@/components/ui/PrazoBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  const animais = useAnimais();
  const lotes = useLotes();
  const tarefas = useTarefasAbertas();

  const total = animais?.length;
  const saudaveis = animais?.filter((a) => a.status === "Saudável").length;
  const pendentes = animais?.filter((a) => a.status === "Vacinação pendente").length;
  const emTratamento = animais?.filter((a) => a.status === "Em tratamento").length;
  const atencao = animais?.filter((a) => a.status !== "Saudável").slice(0, 5) ?? [];

  const alertas = useMemo(
    () => (lotes && tarefas ? coletarAlertas(lotes, tarefas, hoje()) : undefined),
    [lotes, tarefas]
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
                {lotes && lotes.length === 0
                  ? "Crie seus pastos na aba Lotes e configure o remédio e o sal para o app avisar na hora certa."
                  : "Nada atrasado nem previsto para os próximos 7 dias."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alertas?.map((a) => {
                const Icone = ICONE_ALERTA[a.tipo];
                return (
                  <li key={a.chave}>
                    <Link prefetch={false} href={`/lote?id=${a.loteId}`} className="card flex items-center gap-3 p-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          a.dias < 0 ? "bg-red-100 text-red-700" : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        <Icone size={22} weight="duotone" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-dark">{a.titulo}</p>
                        <p className="truncate text-sm text-dark/60">{a.loteNome}</p>
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
            rotulo="Animais no rebanho"
            valor={total}
            Icone={Cow}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo="Pastos"
            valor={lotes?.length}
            Icone={Plant}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo="Saudáveis"
            valor={saudaveis}
            Icone={Heartbeat}
            cor="bg-brand-100 text-brand-700"
          />
          <Indicador
            rotulo="Vacinação pendente"
            valor={pendentes}
            Icone={Syringe}
            cor="bg-amber-100 text-amber-700"
          />
          <Indicador
            rotulo="Em tratamento"
            valor={emTratamento}
            Icone={Stethoscope}
            cor="bg-red-100 text-red-700"
          />
        </div>

        <Link prefetch={false} href="/rebanho?novo=1" className="btn-primary w-full">
          <Plus size={22} weight="bold" />
          Cadastrar animal
        </Link>

        <section>
          <h2 className="mb-3 text-xl font-bold text-dark">Animais que precisam de atenção</h2>
          {animais && atencao.length === 0 ? (
            <div className="card text-sm text-dark/60">
              {animais.length === 0
                ? "Cadastre seus primeiros animais para acompanhar a saúde do rebanho."
                : "Nenhum animal precisa de atenção agora."}
            </div>
          ) : (
            <ul className="space-y-2">
              {atencao.map((a) => (
                <li key={a.id}>
                  <Link prefetch={false} href="/rebanho" className="card flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-dark">{a.nome || "Sem nome"}</p>
                      <p className="text-sm font-semibold text-brand-700">{a.brinco}</p>
                    </div>
                    <StatusBadge status={a.status} />
                    <CaretRight size={18} className="shrink-0 text-dark/30" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
