"use client";

import { useState } from "react";
import { Moon, Plant, ProhibitInset } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { moverLoteGado } from "@/lib/gado";
import { usePastos } from "@/lib/hooks";
import type { LoteGado } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DestinoPastoSheetProps {
  open: boolean;
  lote: LoteGado | null;
  onClose: () => void;
}

/** Lista de pastos para escolher para onde o lote vai. Pasto reservado (descansando) não recebe lotes. */
export function DestinoPastoSheet({ open, lote, onClose }: DestinoPastoSheetProps) {
  const pastos = usePastos();
  const [erro, setErro] = useState("");
  const [movendo, setMovendo] = useState(false);

  async function mover(pastoId: string | null) {
    if (!lote) return;
    setErro("");
    setMovendo(true);
    try {
      await moverLoteGado(lote.id, pastoId);
      setMovendo(false);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível mover.");
      setMovendo(false);
    }
  }

  return (
    <BottomSheet
      open={open && !!lote}
      onClose={onClose}
      title={lote ? `Mover ${lote.nome}` : "Mover lote"}
    >
      <div className="space-y-2 pt-1">
        <p className="text-sm text-dark/60">Escolha o pasto de destino.</p>
        <Erro texto={erro} />

        <ul className="space-y-2">
          {pastos
            ?.filter((p) => p.id !== lote?.pastoId)
            .map((p) => {
              const reservado = p.situacao === "Reservado";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={reservado || movendo}
                    onClick={() => mover(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      reservado
                        ? "border-earth-200 bg-earth-50 text-dark/50"
                        : "border-brand-200 bg-white active:bg-brand-50"
                    )}
                  >
                    {reservado ? (
                      <Moon size={22} className="shrink-0 text-earth-700" />
                    ) : (
                      <Plant size={22} className="shrink-0 text-brand-700" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-dark">{p.nome}</span>
                      <span className="block text-xs text-dark/55">
                        {reservado ? "Descansando: libere o pasto para receber lotes" : `Capim ${p.nivelPasto.toLowerCase()}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}

          {lote?.pastoId && (
            <li>
              <button
                type="button"
                disabled={movendo}
                onClick={() => mover(null)}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-white p-3 text-left active:bg-brand-50"
              >
                <ProhibitInset size={22} className="shrink-0 text-dark/50" />
                <span className="font-semibold text-dark/80">Deixar sem pasto</span>
              </button>
            </li>
          )}
        </ul>

        {pastos && pastos.filter((p) => p.id !== lote?.pastoId).length === 0 && (
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-dark/70">
            Não há outro pasto cadastrado. Crie um na aba Pastos.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
