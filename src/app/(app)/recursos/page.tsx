"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecursoCard } from "@/components/recursos/RecursoCard";
import { RecursoFormSheet } from "@/components/recursos/RecursoFormSheet";
import { Segmented } from "@/components/ui/Segmented";
import { useRecursos, useUsosRecurso } from "@/lib/hooks";
import type { TipoRecurso } from "@/lib/types";

const ROTULOS = ["Suplementos", "Remédios"] as const;
type Rotulo = (typeof ROTULOS)[number];
const TIPO: Record<Rotulo, TipoRecurso> = { Suplementos: "Suplemento", Remédios: "Remédio" };

export default function RecursosPage() {
  const [aba, setAba] = useState<Rotulo>("Suplementos");
  const [novo, setNovo] = useState(false);
  const tipo = TIPO[aba];
  const recursos = useRecursos(tipo);
  const usos = useUsosRecurso();

  // Atalho: /recursos?aba=remedios
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aba") === "remedios") setAba("Remédios");
  }, []);

  return (
    <>
      <PageHeader title="Recursos" subtitle="Estoque de suplementos e remédios" />

      <div className="space-y-4 px-4">
        <Segmented label="Estoque de" value={aba} options={ROTULOS} onChange={setAba} />

        {recursos === undefined ? (
          <p className="py-10 text-center text-sm text-dark/50">Carregando...</p>
        ) : recursos.length === 0 ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Package size={36} weight="duotone" className="text-brand-700" />
            </div>
            <h2 className="text-xl font-bold text-dark">{tipo === "Suplemento" ? "Nenhum suplemento" : "Nenhum remédio"}</h2>
            <p className="mt-1 max-w-xs text-sm text-dark/60">
              {tipo === "Suplemento"
                ? "Cadastre o sal e os suplementos com os sacos e os kg de cada um."
                : "Cadastre os remédios em frascos para baixar do estoque quando medicar um pasto."}
            </p>
            <button type="button" onClick={() => setNovo(true)} className="btn-primary mt-5 w-full max-w-xs">
              <Plus size={20} weight="bold" />
              Cadastrar
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {recursos.map((r) => (
              <li key={r.id}>
                <RecursoCard recurso={r} usos={usos ?? []} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setNovo(true)}
        aria-label={tipo === "Suplemento" ? "Cadastrar suplemento" : "Cadastrar remédio"}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-transform active:scale-95"
      >
        <Plus size={28} weight="bold" />
      </button>

      <RecursoFormSheet open={novo} tipo={tipo} onClose={() => setNovo(false)} />
    </>
  );
}
