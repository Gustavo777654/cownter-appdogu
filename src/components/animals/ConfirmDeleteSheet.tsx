"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { excluirAnimal } from "@/lib/animals";
import type { Animal } from "@/lib/types";

interface ConfirmDeleteSheetProps {
  animal: Animal | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function ConfirmDeleteSheet({ animal, onClose, onDeleted }: ConfirmDeleteSheetProps) {
  const [excluindo, setExcluindo] = useState(false);

  async function confirmar() {
    if (!animal) return;
    setExcluindo(true);
    await excluirAnimal(animal.id);
    setExcluindo(false);
    onDeleted();
  }

  return (
    <BottomSheet
      open={!!animal}
      onClose={onClose}
      title="Excluir animal?"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={excluindo}
            className="btn-danger flex-1"
          >
            {excluindo ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      }
    >
      {animal && (
        <p className="pt-1 text-base text-dark/80">
          O animal <strong>{animal.nome || "Sem nome"}</strong> (brinco{" "}
          <strong>{animal.brinco}</strong>) será removido do seu rebanho.
        </p>
      )}
    </BottomSheet>
  );
}
