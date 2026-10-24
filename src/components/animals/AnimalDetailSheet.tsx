"use client";

import { Cow, PencilSimple, Syringe, Trash } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLotes } from "@/lib/hooks";
import type { Animal } from "@/lib/types";
import { formatDataBR, formatIdade, formatPeso } from "@/lib/utils";

interface AnimalDetailSheetProps {
  animal: Animal | null;
  onClose: () => void;
  onEdit: (animal: Animal) => void;
  onDelete: (animal: Animal) => void;
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-cream p-3">
      <p className="text-xs text-dark/55">{rotulo}</p>
      <p className="mt-0.5 text-sm font-semibold text-dark">{valor || "—"}</p>
    </div>
  );
}

export function AnimalDetailSheet({ animal, onClose, onEdit, onDelete }: AnimalDetailSheetProps) {
  const lotes = useLotes();
  const nomeDoLote = animal?.loteId
    ? (lotes?.find((l) => l.id === animal.loteId)?.nome ?? "")
    : "Sem pasto";

  return (
    <BottomSheet
      open={!!animal}
      onClose={onClose}
      title="Detalhes do animal"
      footer={
        animal && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onDelete(animal)}
              className="btn flex-1 border border-red-200 bg-white text-red-600 hover:bg-red-50"
            >
              <Trash size={20} />
              Excluir
            </button>
            <button type="button" onClick={() => onEdit(animal)} className="btn-primary flex-1">
              <PencilSimple size={20} />
              Editar
            </button>
          </div>
        )
      }
    >
      {animal && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100">
              <Cow size={30} weight="duotone" className="text-brand-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-2xl font-bold text-dark">
                {animal.nome || "Sem nome"}
              </p>
              <p className="text-sm font-semibold text-brand-700">Brinco {animal.brinco}</p>
            </div>
          </div>

          <StatusBadge status={animal.status} />

          <div className="grid grid-cols-2 gap-3">
            <Dado rotulo="Pasto" valor={nomeDoLote} />
            <Dado rotulo="Sexo" valor={animal.sexo} />
            <Dado rotulo="Raça" valor={animal.raca} />
            <Dado rotulo="Idade" valor={formatIdade(animal.dataNascimento)} />
            <Dado rotulo="Peso" valor={formatPeso(animal.pesoKg)} />
            <Dado rotulo="Nascimento" valor={formatDataBR(animal.dataNascimento)} />
            <Dado rotulo="Mãe" valor={animal.mae} />
            <Dado rotulo="Pai" valor={animal.pai} />
          </div>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dark">
              <Syringe size={18} className="text-brand-700" />
              Vacinas já aplicadas
            </h3>
            {animal.vacinas.length === 0 ? (
              <p className="text-sm text-dark/55">Nenhuma vacina registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {animal.vacinas.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-dark">{v.nome}</span>
                    <span className="text-dark/60">{v.data ? formatDataBR(v.data) : "sem data"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {animal.observacoes && (
            <div className="rounded-xl bg-cream p-3">
              <p className="text-xs text-dark/55">Observações</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-dark">{animal.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
